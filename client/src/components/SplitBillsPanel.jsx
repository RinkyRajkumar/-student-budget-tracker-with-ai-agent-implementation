import { CheckCircle2, Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { formatCurrency } from "../services/currency.js";
import { localDateString } from "../services/dates.js";

const billDefaults = {
  title: "",
  place: "",
  totalAmount: "",
  dateTime: `${localDateString()}T19:00`,
  notes: "",
  receiptName: "",
  splitType: "equal",
  payerMemberId: "",
  participantValues: {}
};

function avatar(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function splitPreview(form, members) {
  const total = Number(form.totalAmount || 0);
  const selected = members.filter((member) => form.participantValues[member.id]?.included);
  if (!total || !selected.length) return { shares: [], remaining: total, valid: false };

  if (form.splitType === "equal") {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / selected.length);
    let remainder = cents - base * selected.length;
    return {
      valid: true,
      remaining: 0,
      shares: selected.map((member) => ({
        member,
        amount: (base + (remainder-- > 0 ? 1 : 0)) / 100
      }))
    };
  }

  const valueKey = "amount";
  const shares = selected.map((member) => {
    const raw = Number(form.participantValues[member.id]?.[valueKey] || 0);
    return {
      member,
      amount: raw,
      raw
    };
  });
  const used = shares.reduce((sum, share) => sum + share.amount, 0);
  const target = total;
  return { shares, remaining: Math.round((target - used) * 100) / 100, valid: Math.abs(target - used) < 0.01 };
}

export default function SplitBillsPanel({ data, selectedDate, onCreateGroup, onAddMember, onRemoveMember, onCreateBill, onSettle }) {
  const groups = data?.groups || [];
  const selectedDefault = groups[0]?.id || "";
  const [groupId, setGroupId] = useState(selectedDefault);
  const [groupName, setGroupName] = useState("");
  const [newMembers, setNewMembers] = useState("Rahul, Aisha");
  const [newMemberName, setNewMemberName] = useState("");
  const [form, setForm] = useState(billDefaults);
  const [settleAmount, setSettleAmount] = useState("");
  const [success, setSuccess] = useState("");
  const [ocrState, setOcrState] = useState({ loading: false, error: "", receipt: null });

  const group = groups.find((item) => item.id === Number(groupId)) || groups[0];
  const members = group?.members || [];
  const self = members.find((member) => member.isSelf);
  const preview = useMemo(() => splitPreview(form, members), [form, members]);
  const activeBalances = (data?.balances || []).filter((balance) => Math.abs(balance.net) > 0.009);
  const selectedBalance = activeBalances[0];

  useEffect(() => {
    if (!groupId && selectedDefault) setGroupId(selectedDefault);
  }, [groupId, selectedDefault]);

  useEffect(() => {
    if (!group) return;
    const participantValues = {};
    group.members.forEach((member) => {
      participantValues[member.id] = { included: true, amount: "" };
    });
    setForm((current) => ({
      ...current,
      payerMemberId: current.payerMemberId || group.members.find((member) => member.isSelf)?.id || group.members[0]?.id || "",
      participantValues
    }));
  }, [group?.id]);

  useEffect(() => {
    if (!selectedDate) return;
    setForm((current) => {
      const time = current.dateTime?.includes("T") ? current.dateTime.slice(11) : "19:00";
      return { ...current, dateTime: `${selectedDate}T${time || "19:00"}` };
    });
  }, [selectedDate]);

  async function createGroup(event) {
    event.preventDefault();
    const names = newMembers.split(",").map((item) => item.trim()).filter(Boolean);
    const next = await onCreateGroup({ name: groupName, members: names });
    setGroupName("");
    setNewMembers("");
    setSuccess("Group created");
    if (next?.groups?.[0]) setGroupId(next.groups[0].id);
  }

  async function addMember(event) {
    event.preventDefault();
    if (!group || !newMemberName.trim()) return;
    await onAddMember(group.id, newMemberName.trim());
    setNewMemberName("");
  }

  async function createBill(event) {
    event.preventDefault();
    if (!group || !preview.valid) return;
    const participants = members
      .filter((member) => form.participantValues[member.id]?.included)
      .map((member) => ({
        memberId: member.id,
        amount: form.splitType === "custom" ? Number(form.participantValues[member.id]?.amount || 0) : undefined,
        itemTotal: form.splitType === "item" ? Number(form.participantValues[member.id]?.amount || 0) : undefined
      }));
    await onCreateBill({
      groupId: group.id,
      payerMemberId: Number(form.payerMemberId),
      title: form.title,
      place: form.place,
      totalAmount: Number(form.totalAmount),
      dateTime: form.dateTime,
      notes: form.notes,
      receiptName: form.receiptName,
      splitType: form.splitType,
      participants
    });
    setForm((current) => ({
      ...billDefaults,
      dateTime: `${selectedDate || localDateString()}T19:00`,
      payerMemberId: current.payerMemberId,
      participantValues: current.participantValues
    }));
    setSuccess("Bill split created");
    window.setTimeout(() => setSuccess(""), 2400);
  }

  async function readReceipt(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, receiptName: file.name }));
    setOcrState({ loading: true, error: "", receipt: null });
    try {
      const data = await readImageAsBase64(file);
      const response = await api.post("/receipt-ocr", {
        fileName: file.name,
        mimeType: file.type,
        data
      });
      const receipt = response.data.receipt;
      setForm((current) => {
        const date = receipt.date || current.dateTime.slice(0, 10) || selectedDate || localDateString();
        const time = receipt.time || current.dateTime.slice(11) || "19:00";
        const itemSummary = receipt.items?.length
          ? receipt.items.map((item) => `${item.name} ${formatCurrency(item.amount)}`).join("; ")
          : "";
        const chargeSummary = receipt.extraCharges ? `Extra charges ${formatCurrency(receipt.extraCharges)}` : "";
        const paymentSummary = receipt.paymentMethod ? `Paid via ${receipt.paymentMethod}` : "";
        const ocrNotes = [itemSummary, chargeSummary, paymentSummary].filter(Boolean).join(" | ");
        return {
          ...current,
          title: receipt.title || current.title || "Receipt bill",
          place: receipt.merchant || current.place,
          totalAmount: receipt.totalAmount || current.totalAmount,
          dateTime: `${date}T${time}`,
          notes: receipt.notes || ocrNotes || `OCR from ${file.name}`,
          receiptName: file.name
        };
      });
      setOcrState({ loading: false, error: "", receipt });
    } catch (err) {
      setOcrState({
        loading: false,
        error: err.response?.data?.error?.message || err.message || "Receipt OCR failed.",
        receipt: null
      });
    }
  }

  function readImageAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = () => reject(new Error("Could not read receipt image."));
      reader.readAsDataURL(file);
    });
  }

  async function settle(balance, full = false) {
    if (!balance || !self) return;
    const amount = full ? Math.abs(balance.net) : Number(settleAmount || 0);
    if (!amount) return;
    const payload =
      balance.direction === "owed_to_you"
        ? { fromMemberId: balance.memberId, toMemberId: self.id, amount, settledAt: localDateString(), note: "Food bill settlement" }
        : { fromMemberId: self.id, toMemberId: balance.memberId, amount, settledAt: localDateString(), note: "Food bill settlement" };
    await onSettle(payload);
    setSettleAmount("");
    setSuccess("Payment marked settled");
    window.setTimeout(() => setSuccess(""), 2400);
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="text-violet-300" size={20} />
          <h2 className="text-lg font-bold tracking-normal">Split Bills</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">Groups, shared food bills, balances, and settlements.</p>
        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 transition">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        <form className="rounded-lg bg-slate-900/70 p-3" onSubmit={createGroup}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UsersRound size={16} />
            Create group
          </div>
          <input className="input mt-3" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Roommates dinner" required />
          <input className="input mt-2" value={newMembers} onChange={(event) => setNewMembers(event.target.value)} placeholder="Rahul, Aisha, Sam" />
          <button className="btn-primary mt-2 w-full">
            <Plus size={16} />
            Create group
          </button>
        </form>

        {group && (
          <>
            <div className="rounded-lg bg-slate-900/70 p-3">
              <select className="input" value={group.id} onChange={(event) => setGroupId(event.target.value)}>
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex flex-wrap gap-2">
                {members.map((member) => (
                  <span key={member.id} className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 py-1 pl-1 pr-2 text-xs text-violet-100">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500 text-[11px] font-bold">{avatar(member.name)}</span>
                    {member.name}
                    {!member.isSelf && (
                      <button type="button" onClick={() => onRemoveMember(group.id, member.id)} aria-label={`Remove ${member.name}`}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <form className="mt-3 flex gap-2" onSubmit={addMember}>
                <input className="input" value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="Add friend" />
                <button className="btn-soft px-3">
                  <Plus size={16} />
                </button>
              </form>
            </div>

            <form className="space-y-3 rounded-lg bg-slate-900/70 p-3" onSubmit={createBill}>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bill title" required />
                <input className="input" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} placeholder="Food place" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="number" min="1" step="0.01" value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} placeholder="Total amount" required />
                <input className="input" type="datetime-local" value={form.dateTime} onChange={(event) => setForm({ ...form, dateTime: event.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={form.payerMemberId} onChange={(event) => setForm({ ...form, payerMemberId: event.target.value })}>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      Paid by {member.name}
                    </option>
                  ))}
                </select>
                <select className="input" value={form.splitType} onChange={(event) => setForm({ ...form, splitType: event.target.value })}>
                  <option value="equal">Equal split</option>
                  <option value="custom">Custom amount</option>
                  <option value="item">Item-based</option>
                </select>
              </div>
              <input className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes or fair split context" />
              <label className="block rounded-lg border border-dashed border-violet-300/30 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                Receipt image
                <input
                  className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-violet-500 file:px-3 file:py-1.5 file:text-white"
                  type="file"
                  accept="image/*"
                  onChange={readReceipt}
                />
                {form.receiptName && <span className="mt-1 block text-xs text-violet-300">{form.receiptName}</span>}
                {ocrState.loading && <span className="mt-1 block text-xs text-amber-200">Gemini OCR is reading the receipt...</span>}
                {ocrState.error && <span className="mt-1 block text-xs text-rose-200">{ocrState.error}</span>}
                {ocrState.receipt && (
                  <span className="mt-2 block rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100">
                    OCR found {ocrState.receipt.merchant || "receipt"} for {formatCurrency(ocrState.receipt.totalAmount)}.
                    {!!ocrState.receipt.items?.length && (
                      <span className="mt-1 block text-emerald-200">
                        {ocrState.receipt.items.map((item) => `${item.name}: ${formatCurrency(item.amount)}`).join(" - ")}
                      </span>
                    )}
                    {!!ocrState.receipt.extraCharges && (
                      <span className="mt-1 block text-emerald-200">
                        Extra charges: {formatCurrency(ocrState.receipt.extraCharges)}
                      </span>
                    )}
                  </span>
                )}
              </label>

              <div className="space-y-2">
                {members.map((member) => {
                  const value = form.participantValues[member.id] || { included: true };
                  return (
                    <div key={member.id} className="grid grid-cols-[auto_1fr_96px] items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(value.included)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            participantValues: { ...form.participantValues, [member.id]: { ...value, included: event.target.checked } }
                          })
                        }
                      />
                      <span className="truncate text-sm text-slate-200">{member.name}</span>
                      {form.splitType !== "equal" && (
                        <input
                          className="input py-1"
                          type="number"
                          min="0"
                          step="0.01"
                          value={value.amount || ""}
                          placeholder="INR"
                          onChange={(event) =>
                            setForm({
                              ...form,
                              participantValues: {
                                ...form.participantValues,
                                [member.id]: {
                                  ...value,
                                  amount: event.target.value
                                }
                              }
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={`rounded-lg px-3 py-2 text-sm ${preview.valid ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                {preview.valid ? "Split is balanced." : `Remaining: ${formatCurrency(preview.remaining)}`}
              </div>
              <div className="grid gap-1 text-xs text-slate-400">
                {preview.shares.map((share) => (
                  <div key={share.member.id} className="flex justify-between">
                    <span>{share.member.name}</span>
                    <span>{formatCurrency(share.amount)}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary w-full" disabled={!preview.valid}>
                Split bill
              </button>
            </form>
          </>
        )}

        <div className="rounded-lg bg-slate-900/70 p-3">
          <h3 className="text-sm font-semibold">Balances</h3>
          <div className="mt-2 space-y-2">
            {activeBalances.length === 0 ? (
              <p className="text-sm text-slate-400">No pending food bill balances.</p>
            ) : (
              activeBalances.map((balance) => (
                <div key={balance.memberId} className="rounded-lg bg-slate-950/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200">{balance.name}</span>
                    <span className={balance.direction === "owed_to_you" ? "text-sm font-bold text-emerald-300" : "text-sm font-bold text-rose-300"}>
                      {balance.direction === "owed_to_you" ? "Owes you" : "You owe"} {formatCurrency(Math.abs(balance.net))}
                    </span>
                  </div>
                  <button className="btn-soft mt-2 w-full py-1.5" onClick={() => settle(balance, true)}>
                    Mark settled
                  </button>
                </div>
              ))
            )}
          </div>
          {selectedBalance && (
            <div className="mt-3 flex gap-2">
              <input className="input" type="number" min="1" step="0.01" value={settleAmount} onChange={(event) => setSettleAmount(event.target.value)} placeholder="Partial payment" />
              <button className="btn-soft" onClick={() => settle(selectedBalance, false)}>Settle</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-violet-500/10 p-3 text-xs">
          <div className="rounded-lg bg-slate-950/60 p-2">
            <p className="text-slate-400">Monthly shared food</p>
            <p className="mt-1 text-base font-bold">{formatCurrency(data?.analytics?.monthlySharedFood || 0)}</p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2">
            <p className="text-slate-400">Top partner</p>
            <p className="mt-1 text-base font-bold">{data?.analytics?.mostFrequentPartner?.name || "None"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
