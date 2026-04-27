import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "./app.js";

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

describe("student budget API", () => {
  it("reports health", async () => {
    const { response, body } = await request("/health");
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  });

  it("logs in demo user and returns protected summary", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@student.edu", password: "Student123!" })
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.body.token);

    const summary = await request("/summary", {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.equal(summary.response.status, 200);
    assert.ok(summary.body.summary.monthlyTotal >= 0);
  });

  it("opens a local profile without showing the login page", async () => {
    const local = await request("/auth/local");
    assert.equal(local.response.status, 200);
    assert.ok(local.body.token);
    assert.equal(local.body.user.email, "demo@student.edu");

    const summary = await request("/summary");
    assert.equal(summary.response.status, 200);
    assert.ok(summary.body.summary.monthlyTotal >= 0);
  });

  it("uses expense notes for smart advice", async () => {
    const local = await request("/auth/local");
    const advice = await request("/advice", {
      headers: { Authorization: `Bearer ${local.body.token}` }
    });
    assert.equal(advice.response.status, 200);
    assert.ok(Array.isArray(advice.body.advice.noteInsights));
    assert.ok(advice.body.advice.suggestions.length > 0);
  });

  it("lists recurring subscriptions stored locally", async () => {
    const local = await request("/auth/local");
    const listed = await request("/subscriptions", {
      headers: { Authorization: `Bearer ${local.body.token}` }
    });

    assert.equal(listed.response.status, 200);
    assert.ok(Array.isArray(listed.body.subscriptions));
    assert.ok(listed.body.subscriptions.some((subscription) => subscription.name.includes("Spotify")));
  });

  it("rejects invalid expense amounts", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@student.edu", password: "Student123!" })
    });
    const invalid = await request("/expenses", {
      method: "POST",
      headers: { Authorization: `Bearer ${login.body.token}` },
      body: JSON.stringify({
        amount: -2,
        categoryId: 1,
        date: "2026-04-25",
        note: "bad amount",
        paymentMethod: "card"
      })
    });
    assert.equal(invalid.response.status, 422);
  });

  it("rejects impossible calendar dates", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@student.edu", password: "Student123!" })
    });
    const invalid = await request("/expenses", {
      method: "POST",
      headers: { Authorization: `Bearer ${login.body.token}` },
      body: JSON.stringify({
        amount: 2,
        categoryId: 1,
        date: "2026-99-99",
        note: "bad date",
        paymentMethod: "card"
      })
    });
    assert.equal(invalid.response.status, 422);
  });

  it("exports expenses as CSV from the documented route", async () => {
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@student.edu", password: "Student123!" })
    });
    const exported = await request("/export.csv", {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.equal(exported.response.status, 200);
    assert.match(exported.body, /^date,category,note,payment_method,amount/);
  });
});
