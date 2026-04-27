import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const receiptSchema = z.object({
  body: z.object({
    fileName: z.string().trim().max(160).optional().default("receipt"),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
    data: z.string().min(100).max(14_000_000)
  })
});

function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new ApiError(502, "OCR_PARSE_ERROR", "Gemini returned receipt text, but it was not valid JSON.");
  }
}

function parseAmount(value) {
  const amount = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 0;
}

function parseReceiptDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return "";

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseReceiptTime(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return "";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function normalizeReceipt(parsed, fallbackName) {
  const totalAmount = parseAmount(parsed.totalAmount || parsed.total || parsed.grandTotal);
  const subtotalAmount = parseAmount(parsed.subtotalAmount || parsed.subtotal || parsed.subTotal);
  const extraCharges = parseAmount(parsed.extraCharges || parsed.charges || parsed.serviceCharge || parsed.gasCharge);
  return {
    merchant: String(parsed.merchant || parsed.restaurant || parsed.place || "").slice(0, 100),
    title: String(parsed.title || parsed.merchant || fallbackName || "Receipt bill").slice(0, 100),
    totalAmount,
    subtotalAmount,
    extraCharges,
    date: parseReceiptDate(parsed.date || parsed.billDate),
    time: parseReceiptTime(parsed.time || parsed.billTime),
    notes: String(parsed.notes || "").slice(0, 240),
    paymentMethod: String(parsed.paymentMethod || "").slice(0, 40),
    currency: String(parsed.currency || "INR").slice(0, 8),
    items: Array.isArray(parsed.items)
      ? parsed.items.slice(0, 25).map((item) => ({
          name: String(item.name || "").slice(0, 80),
          quantity: Number.isFinite(Number(item.quantity || item.qty)) ? Number(item.quantity || item.qty) : 1,
          unitPrice: parseAmount(item.unitPrice || item.price),
          amount: parseAmount(item.amount || item.total)
        }))
      : [],
    confidence: String(parsed.confidence || "medium").slice(0, 20)
  };
}

router.post(
  "/",
  validate(receiptSchema),
  asyncHandler(async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, "GEMINI_API_KEY_MISSING", "Add GEMINI_API_KEY to server/.env to enable receipt OCR.");
    }

    const { fileName, mimeType, data } = req.validated.body;
    const prompt = [
      "You are a receipt OCR agent for a student split-bill app.",
      "The receipt may be from India and may use DD/MM/YY dates, INR symbols, UPI payments, GSTIN text, and charges such as gas/service/packing fees.",
      "Read this receipt image and return ONLY strict JSON with these keys:",
      "merchant, title, totalAmount, subtotalAmount, extraCharges, date, time, currency, paymentMethod, notes, confidence, items.",
      "Use YYYY-MM-DD for date and HH:mm for time when visible.",
      "totalAmount must be the final Grand Total payable amount in INR.",
      "subtotalAmount should be the subtotal before extra charges when visible.",
      "extraCharges should combine service, gas, packing, delivery, and similar fixed charges.",
      "items must be an array of {name, quantity, unitPrice, amount}.",
      "Ignore GSTIN, token number, cashier, and bill number unless useful in notes.",
      "If a field is not visible, use an empty string or 0."
    ].join(" ");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data } },
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        })
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new ApiError(response.status, "GEMINI_OCR_FAILED", payload.error?.message || "Gemini OCR request failed.");
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
    const receipt = normalizeReceipt(extractJson(text), fileName);
    res.json({ receipt });
  })
);

export default router;
