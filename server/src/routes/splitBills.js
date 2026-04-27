import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { validate } from "../middleware/validate.js";
import { currentMonth, isValidIsoDate } from "../utils/dates.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { fromCents, toCents } from "../utils/money.js";

const router = Router();

const dateTime = z.string().min(10).max(30).refine((value) => isValidIsoDate(value.slice(0, 10)), "Enter a real date.");

const groupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    members: z.array(z.string().trim().min(1).max(60)).max(12).default([])
  })
});

const memberSchema = z.object({
  params: z.object({ groupId: z.coerce.number().int().positive() }),
  body: z.object({ name: z.string().trim().min(1).max(60) })
});

const memberParam = z.object({
  params: z.object({
    groupId: z.coerce.number().int().positive(),
    memberId: z.coerce.number().int().positive()
  })
});

const billSchema = z.object({
  body: z.object({
    groupId: z.coerce.number().int().positive(),
    payerMemberId: z.coerce.number().int().positive(),
    title: z.string().trim().min(2).max(100),
    place: z.string().trim().min(1).max(100),
    totalAmount: z.coerce.number().positive().max(1000000),
    dateTime,
    notes: z.string().trim().max(240).optional().default(""),
    receiptName: z.string().trim().max(140).optional().default(""),
    splitType: z.enum(["equal", "custom", "item"]),
    participants: z.array(
      z.object({
        memberId: z.coerce.number().int().positive(),
        amount: z.coerce.number().min(0).optional(),
        itemTotal: z.coerce.number().min(0).optional()
      })
    ).min(1).max(20)
  })
});

const settlementSchema = z.object({
  body: z.object({
    fromMemberId: z.coerce.number().int().positive(),
    toMemberId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive().max(1000000),
    settledAt: z.string().refine(isValidIsoDate, "Enter a real date."),
    note: z.string().trim().max(180).optional().default("")
  })
});

function ensureGroup(userId, groupId) {
  const group = db.prepare("SELECT * FROM split_groups WHERE id = ? AND user_id = ?").get(groupId, userId);
  if (!group) throw new ApiError(404, "NOT_FOUND", "Split group not found.");
  return group;
}

function ensureMember(groupId, memberId) {
  const member = db.prepare("SELECT * FROM split_group_members WHERE id = ? AND group_id = ?").get(memberId, groupId);
  if (!member) throw new ApiError(422, "VALIDATION_ERROR", "Select valid participants from this group.");
  return member;
}

function mapMember(row) {
  return { id: row.id, groupId: row.group_id, name: row.name, isSelf: Boolean(row.is_self), initials: initials(row.name) };
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function calculateShares({ totalCents, splitType, participants }) {
  if (splitType === "equal") {
    const base = Math.floor(totalCents / participants.length);
    let remainder = totalCents - base * participants.length;
    return participants.map((participant) => ({
      memberId: participant.memberId,
      shareCents: base + (remainder-- > 0 ? 1 : 0)
    }));
  }

  const key = splitType === "item" ? "itemTotal" : "amount";
  const shares = participants.map((participant) => ({ memberId: participant.memberId, shareCents: toCents(participant[key] || 0) }));
  const total = shares.reduce((sum, share) => sum + share.shareCents, 0);
  if (total !== totalCents) throw new ApiError(422, "VALIDATION_ERROR", "Manual splits must exactly match the bill total.");
  return shares;
}

function createFoodExpense({ userId, amountCents, spentAt, note }) {
  const food = db.prepare("SELECT id FROM categories WHERE name = ?").get("Food");
  const result = db
    .prepare(
      `INSERT INTO expenses (user_id, category_id, amount_cents, spent_at, note, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, food?.id || 1, amountCents, spentAt, note, "other");
  return result.lastInsertRowid;
}

function createExpenseForSelfPaidBill({ userId, groupId, payerMemberId, title, place, totalCents, billAt }) {
  const payer = ensureMember(groupId, payerMemberId);
  if (!payer.is_self) return null;
  return createFoodExpense({
    userId,
    amountCents: totalCents,
    spentAt: billAt.slice(0, 10),
    note: `Split bill: ${title} at ${place}`
  });
}

function buildOverview(userId) {
  const groups = db.prepare("SELECT * FROM split_groups WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  const members = db
    .prepare(
      `SELECT m.*
       FROM split_group_members m JOIN split_groups g ON g.id = m.group_id
       WHERE g.user_id = ?
       ORDER BY m.is_self DESC, m.name ASC`
    )
    .all(userId);
  const bills = db
    .prepare(
      `SELECT b.*, g.name AS group_name, payer.name AS payer_name
       FROM split_bills b
       JOIN split_groups g ON g.id = b.group_id
       JOIN split_group_members payer ON payer.id = b.payer_member_id
       WHERE b.user_id = ?
       ORDER BY b.bill_at DESC, b.id DESC`
    )
    .all(userId);
  const shares = db
    .prepare(
      `SELECT s.*, m.name, m.is_self
       FROM split_bill_shares s JOIN split_group_members m ON m.id = s.member_id
       JOIN split_bills b ON b.id = s.bill_id
       WHERE b.user_id = ?`
    )
    .all(userId);
  const settlements = db
    .prepare(
      `SELECT st.*, fm.name AS from_name, tm.name AS to_name
       FROM split_settlements st
       JOIN split_group_members fm ON fm.id = st.from_member_id
       JOIN split_group_members tm ON tm.id = st.to_member_id
       WHERE st.user_id = ?
       ORDER BY st.settled_at DESC, st.id DESC`
    )
    .all(userId);

  const membersByGroup = members.reduce((acc, member) => {
    if (!acc[member.group_id]) acc[member.group_id] = [];
    acc[member.group_id].push(mapMember(member));
    return acc;
  }, {});
  const sharesByBill = shares.reduce((acc, share) => {
    if (!acc[share.bill_id]) acc[share.bill_id] = [];
    acc[share.bill_id].push({
      memberId: share.member_id,
      name: share.name,
      isSelf: Boolean(share.is_self),
      share: fromCents(share.share_cents),
      paid: fromCents(share.paid_cents),
      remaining: fromCents(Math.max(0, share.share_cents - share.paid_cents))
    });
    return acc;
  }, {});

  const selfMembers = new Set(members.filter((member) => member.is_self).map((member) => member.id));
  const balances = new Map();
  bills.forEach((bill) => {
    const billShares = sharesByBill[bill.id] || [];
    billShares.forEach((share) => {
      if (share.memberId === bill.payer_member_id) return;
      const cents = toCents(share.remaining);
      if (!cents) return;
      const payerIsSelf = selfMembers.has(bill.payer_member_id);
      const shareIsSelf = selfMembers.has(share.memberId);
      if (!payerIsSelf && !shareIsSelf) return;
      const friendId = payerIsSelf ? share.memberId : bill.payer_member_id;
      const friendName = payerIsSelf ? share.name : bill.payer_name;
      const current = balances.get(friendId) || { memberId: friendId, name: friendName, netCents: 0 };
      current.netCents += payerIsSelf ? cents : -cents;
      balances.set(friendId, current);
    });
  });
  settlements.forEach((settlement) => {
    const fromIsSelf = selfMembers.has(settlement.from_member_id);
    const toIsSelf = selfMembers.has(settlement.to_member_id);
    if (!fromIsSelf && !toIsSelf) return;
    const friendId = fromIsSelf ? settlement.to_member_id : settlement.from_member_id;
    const friendName = fromIsSelf ? settlement.to_name : settlement.from_name;
    const current = balances.get(friendId) || { memberId: friendId, name: friendName, netCents: 0 };
    current.netCents += fromIsSelf ? settlement.amount_cents : -settlement.amount_cents;
    balances.set(friendId, current);
  });

  const month = currentMonth();
  const monthlyFoodCents = bills
    .filter((bill) => bill.bill_at.slice(0, 7) === month)
    .reduce((total, bill) => total + bill.total_cents, 0);
  const partnerCounts = bills.reduce((acc, bill) => {
    (sharesByBill[bill.id] || []).forEach((share) => {
      if (!share.isSelf) acc[share.name] = (acc[share.name] || 0) + 1;
    });
    return acc;
  }, {});
  const topPartner = Object.entries(partnerCounts).sort((a, b) => b[1] - a[1])[0] || null;
  const weekendSpend = bills
    .filter((bill) => [0, 6].includes(new Date(`${bill.bill_at.slice(0, 10)}T00:00:00`).getDay()))
    .reduce((total, bill) => total + bill.total_cents, 0);

  return {
    groups: groups.map((group) => ({ id: group.id, name: group.name, members: membersByGroup[group.id] || [] })),
    bills: bills.map((bill) => ({
      id: bill.id,
      groupId: bill.group_id,
      groupName: bill.group_name,
      payerMemberId: bill.payer_member_id,
      payerName: bill.payer_name,
      title: bill.title,
      place: bill.place,
      totalAmount: fromCents(bill.total_cents),
      dateTime: bill.bill_at,
      notes: bill.notes || "",
      receiptName: bill.receipt_name || "",
      splitType: bill.split_type,
      status: bill.status,
      shares: sharesByBill[bill.id] || []
    })),
    balances: [...balances.values()]
      .filter((balance) => balance.netCents !== 0)
      .map((balance) => ({
        memberId: balance.memberId,
        name: balance.name,
        net: fromCents(balance.netCents),
        direction: balance.netCents >= 0 ? "owed_to_you" : "you_owe"
      })),
    settlements: settlements.map((settlement) => ({
      id: settlement.id,
      fromName: settlement.from_name,
      toName: settlement.to_name,
      amount: fromCents(settlement.amount_cents),
      settledAt: settlement.settled_at,
      note: settlement.note || ""
    })),
    analytics: {
      monthlySharedFood: fromCents(monthlyFoodCents),
      mostFrequentPartner: topPartner ? { name: topPartner[0], count: topPartner[1] } : null,
      billCount: bills.length,
      pendingCount: bills.filter((bill) => bill.status !== "settled").length
    },
    insights: [
      weekendSpend > monthlyFoodCents * 0.45 && monthlyFoodCents
        ? "You spend most shared food money on weekend dining."
        : "Your shared dining is spread across the month.",
      topPartner ? `You frequently split bills with ${topPartner[0]}.` : "Add friends to unlock partner insights.",
      "Receipt upload stores the file name now; OCR extraction can be wired to a vision API later."
    ]
  };
}

router.get("/", (req, res) => {
  res.json(buildOverview(req.user.id));
});

router.post(
  "/groups",
  validate(groupSchema),
  asyncHandler(async (req, res) => {
    const { name, members } = req.validated.body;
    const result = db.prepare("INSERT INTO split_groups (user_id, name) VALUES (?, ?)").run(req.user.id, name);
    const groupId = result.lastInsertRowid;
    db.prepare("INSERT INTO split_group_members (group_id, name, is_self) VALUES (?, ?, 1)").run(groupId, "You");
    const insertMember = db.prepare("INSERT INTO split_group_members (group_id, name, is_self) VALUES (?, ?, 0)");
    [...new Set(members.filter((member) => member.toLowerCase() !== "you"))].forEach((member) => insertMember.run(groupId, member));
    res.status(201).json(buildOverview(req.user.id));
  })
);

router.post(
  "/groups/:groupId/members",
  validate(memberSchema),
  asyncHandler(async (req, res) => {
    ensureGroup(req.user.id, req.validated.params.groupId);
    db.prepare("INSERT INTO split_group_members (group_id, name, is_self) VALUES (?, ?, 0)").run(
      req.validated.params.groupId,
      req.validated.body.name
    );
    res.status(201).json(buildOverview(req.user.id));
  })
);

router.delete(
  "/groups/:groupId/members/:memberId",
  validate(memberParam),
  asyncHandler(async (req, res) => {
    ensureGroup(req.user.id, req.validated.params.groupId);
    const member = ensureMember(req.validated.params.groupId, req.validated.params.memberId);
    if (member.is_self) throw new ApiError(422, "VALIDATION_ERROR", "You cannot remove yourself from a split group.");
    db.prepare("DELETE FROM split_group_members WHERE id = ? AND group_id = ?").run(member.id, req.validated.params.groupId);
    res.json(buildOverview(req.user.id));
  })
);

router.post(
  "/bills",
  validate(billSchema),
  asyncHandler(async (req, res) => {
    const body = req.validated.body;
    ensureGroup(req.user.id, body.groupId);
    ensureMember(body.groupId, body.payerMemberId);
    body.participants.forEach((participant) => ensureMember(body.groupId, participant.memberId));
    const totalCents = toCents(body.totalAmount);
    const shares = calculateShares({ totalCents, splitType: body.splitType, participants: body.participants });
    const expenseId = createExpenseForSelfPaidBill({
      userId: req.user.id,
      groupId: body.groupId,
      payerMemberId: body.payerMemberId,
      title: body.title,
      place: body.place,
      totalCents,
      billAt: body.dateTime
    });
    const result = db
      .prepare(
        `INSERT INTO split_bills
          (user_id, group_id, payer_member_id, title, place, total_cents, bill_at, notes, receipt_name, expense_id, split_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, body.groupId, body.payerMemberId, body.title, body.place, totalCents, body.dateTime, body.notes, body.receiptName, expenseId, body.splitType);
    const insertShare = db.prepare("INSERT INTO split_bill_shares (bill_id, member_id, share_cents, paid_cents) VALUES (?, ?, ?, ?)");
    shares.forEach((share) => insertShare.run(result.lastInsertRowid, share.memberId, share.shareCents, share.memberId === body.payerMemberId ? share.shareCents : 0));
    res.status(201).json(buildOverview(req.user.id));
  })
);

router.post(
  "/settlements",
  validate(settlementSchema),
  asyncHandler(async (req, res) => {
    const { fromMemberId, toMemberId, amount, settledAt, note } = req.validated.body;
    if (fromMemberId === toMemberId) throw new ApiError(422, "VALIDATION_ERROR", "Settlement needs two different people.");
    const fromMember = db.prepare("SELECT * FROM split_group_members WHERE id = ?").get(fromMemberId);
    if (fromMember?.is_self) {
      createFoodExpense({
        userId: req.user.id,
        amountCents: toCents(amount),
        spentAt: settledAt,
        note: note || "Split bill settlement"
      });
    }
    db.prepare(
      "INSERT INTO split_settlements (user_id, from_member_id, to_member_id, amount_cents, settled_at, note) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(req.user.id, fromMemberId, toMemberId, toCents(amount), settledAt, note);
    res.status(201).json(buildOverview(req.user.id));
  })
);

export default router;
