import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient";

const STATUS_STAGES = ["Prospecting", "Listed", "Under offer", "Closed"];

const STATUS_COLOR = {
  Prospecting: { bg: "#EFE6D3", text: "#6B5122", border: "#C9A54B" },
  Listed: { bg: "#DCE6D6", text: "#3F5A33", border: "#7FA168" },
  "Under offer": { bg: "#F0DED3", text: "#7A3E1E", border: "#C8763E" },
  Closed: { bg: "#DED8CB", text: "#3A342A", border: "#8A7F68" },
};

const SERVICE_TYPES = ["Title Transfer", "Adverse Claim Filing", "Mortgage/Loan Consulting", "Other"];
const SERVICE_STATUSES = ["In progress", "Completed"];
const SERVICE_STATUS_COLOR = {
  "In progress": { bg: "#EFE6D3", text: "#6B5122", border: "#C9A54B" },
  Completed: { bg: "#DCE6D6", text: "#3F5A33", border: "#7FA168" },
};
const PAYMENT_COLOR = {
  Paid: { bg: "#DCE6D6", text: "#3F5A33", border: "#7FA168" },
  Unpaid: { bg: "#F0DED3", text: "#7A3E1E", border: "#C8763E" },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(iso, hhmm) {
  const date = formatDate(iso);
  const time = formatTime(hhmm);
  if (!date) return "";
  return time ? `${date} · ${time}` : date;
}

function formatMoney(v) {
  const n = Number(v);
  if (!v || isNaN(n)) return "";
  return "₱" + n.toLocaleString();
}

const emptyData = {
  clients: [],
  listings: [],
  followups: [],
  services: [],
  personalEvents: [],
  assets: [],
  liabilities: [],
  cashflow: [],
  beginningBalances: { Business: "", Personal: "" },
};

const FINANCE_SCOPES = ["Business", "Personal"];
const ASSET_CATEGORIES = ["Cash/Bank", "Receivables", "Investment", "Crypto", "Real Estate", "Other"];
const LIABILITY_CATEGORIES = [
  "Housing Loan/Mortgage",
  "Auto Loan",
  "Credit Card",
  "Personal Loan",
  "Accounts Payable",
  "Taxes Payable",
  "Other",
];
const CASHFLOW_TYPES = ["Income", "Expense"];
const INCOME_CATEGORIES = ["Salary/Payroll", "Business Collections", "Cash Sales", "Investment Income", "Other Income"];
const EXPENSE_CATEGORIES = [
  "Operating Expenses",
  "Loan Payments/Payables",
  "Taxes",
  "Personal/Living Expenses",
  "Other Expenses",
];
const CASHFLOW_STATUSES = ["Actual", "Forecasted"];

function normalize(d) {
  const safe = d && typeof d === "object" ? d : {};
  const safeBB = safe.beginningBalances && typeof safe.beginningBalances === "object" ? safe.beginningBalances : {};
  return {
    clients: Array.isArray(safe.clients) ? safe.clients : [],
    listings: Array.isArray(safe.listings) ? safe.listings : [],
    followups: Array.isArray(safe.followups) ? safe.followups : [],
    services: Array.isArray(safe.services) ? safe.services : [],
    personalEvents: Array.isArray(safe.personalEvents) ? safe.personalEvents : [],
    assets: Array.isArray(safe.assets) ? safe.assets : [],
    liabilities: Array.isArray(safe.liabilities) ? safe.liabilities : [],
    cashflow: Array.isArray(safe.cashflow) ? safe.cashflow : [],
    beginningBalances: { Business: safeBB.Business ?? "", Personal: safeBB.Personal ?? "" },
  };
}

function CRM({ userId }) {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState("clients");
  const [mode, setMode] = useState("business");
  const effectiveFinanceScope = mode === "business" ? "Business" : "Personal";
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [clientFormError, setClientFormError] = useState("");
  const [editingClientId, setEditingClientId] = useState(null);

  const [showListingForm, setShowListingForm] = useState(false);
  const [editingListingId, setEditingListingId] = useState(null);
  const [listingFormError, setListingFormError] = useState("");
  const [listingForm, setListingForm] = useState({ clientId: "", address: "", price: "", status: "Prospecting", notes: "" });

  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [editingFollowupId, setEditingFollowupId] = useState(null);
  const [followupFormError, setFollowupFormError] = useState("");
  const [followupForm, setFollowupForm] = useState({ clientId: "", note: "", dueDate: todayISO(), dueTime: "", notes: "" });

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceFormError, setServiceFormError] = useState("");
  const [serviceForm, setServiceForm] = useState({
    clientId: "",
    type: SERVICE_TYPES[0],
    fee: "",
    dueDate: todayISO(),
    dueTime: "",
    status: "In progress",
    paymentStatus: "Unpaid",
    notes: "",
  });

  const [showPersonalForm, setShowPersonalForm] = useState(false);
  const [editingPersonalId, setEditingPersonalId] = useState(null);
  const [personalForm, setPersonalForm] = useState({ title: "", date: todayISO(), time: "", notes: "" });

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [assetFormError, setAssetFormError] = useState("");
  const [assetForm, setAssetForm] = useState({ name: "", category: ASSET_CATEGORIES[0], value: "", notes: "" });

  const [showLiabilityForm, setShowLiabilityForm] = useState(false);
  const [editingLiabilityId, setEditingLiabilityId] = useState(null);
  const [liabilityFormError, setLiabilityFormError] = useState("");
  const [liabilityForm, setLiabilityForm] = useState({ name: "", category: LIABILITY_CATEGORIES[0], balance: "", notes: "" });

  const [showCashflowForm, setShowCashflowForm] = useState(false);
  const [editingCashflowId, setEditingCashflowId] = useState(null);
  const [cashflowFormError, setCashflowFormError] = useState("");
  const [cashflowForm, setCashflowForm] = useState({
    type: "Income",
    category: INCOME_CATEGORIES[0],
    description: "",
    amount: "",
    date: todayISO(),
    status: "Actual",
    notes: "",
  });

  function addAsset() {
    if (!assetForm.name.trim()) {
      setAssetFormError("Please enter a name.");
      return;
    }
    setAssetFormError("");
    if (editingAssetId) {
      updateData((d) => ({ ...d, assets: d.assets.map((a) => (a.id === editingAssetId ? { ...a, ...assetForm } : a)) }));
      setEditingAssetId(null);
    } else {
      updateData((d) => ({ ...d, assets: [...d.assets, { id: uid(), scope: effectiveFinanceScope, ...assetForm }] }));
    }
    setAssetForm({ name: "", category: ASSET_CATEGORIES[0], value: "", notes: "" });
    setShowAssetForm(false);
  }

  function startEditAsset(asset) {
    setAssetForm({ name: asset.name, category: asset.category, value: asset.value, notes: asset.notes || "" });
    setEditingAssetId(asset.id);
    setAssetFormError("");
    setShowAssetForm(true);
  }

  function deleteAsset(id) {
    updateData((d) => ({ ...d, assets: d.assets.filter((a) => a.id !== id) }));
  }

  function addLiability() {
    if (!liabilityForm.name.trim()) {
      setLiabilityFormError("Please enter a name.");
      return;
    }
    setLiabilityFormError("");
    if (editingLiabilityId) {
      updateData((d) => ({
        ...d,
        liabilities: d.liabilities.map((l) => (l.id === editingLiabilityId ? { ...l, ...liabilityForm } : l)),
      }));
      setEditingLiabilityId(null);
    } else {
      updateData((d) => ({ ...d, liabilities: [...d.liabilities, { id: uid(), scope: effectiveFinanceScope, ...liabilityForm }] }));
    }
    setLiabilityForm({ name: "", category: LIABILITY_CATEGORIES[0], balance: "", notes: "" });
    setShowLiabilityForm(false);
  }

  function startEditLiability(liability) {
    setLiabilityForm({
      name: liability.name,
      category: liability.category,
      balance: liability.balance,
      notes: liability.notes || "",
    });
    setEditingLiabilityId(liability.id);
    setLiabilityFormError("");
    setShowLiabilityForm(true);
  }

  function deleteLiability(id) {
    updateData((d) => ({ ...d, liabilities: d.liabilities.filter((l) => l.id !== id) }));
  }

  function addCashflow() {
    if (!cashflowForm.description.trim()) {
      setCashflowFormError("Please enter a description.");
      return;
    }
    if (!cashflowForm.amount || isNaN(Number(cashflowForm.amount))) {
      setCashflowFormError("Please enter a valid amount.");
      return;
    }
    setCashflowFormError("");
    if (editingCashflowId) {
      updateData((d) => ({
        ...d,
        cashflow: d.cashflow.map((c) => (c.id === editingCashflowId ? { ...c, ...cashflowForm } : c)),
      }));
      setEditingCashflowId(null);
    } else {
      updateData((d) => ({ ...d, cashflow: [...d.cashflow, { id: uid(), scope: effectiveFinanceScope, ...cashflowForm }] }));
    }
    setCashflowForm({
      type: "Income",
      category: INCOME_CATEGORIES[0],
      description: "",
      amount: "",
      date: todayISO(),
      status: "Actual",
      notes: "",
    });
    setShowCashflowForm(false);
  }

  function startEditCashflow(entry) {
    setCashflowForm({
      type: entry.type,
      category: entry.category,
      description: entry.description || "",
      amount: entry.amount,
      date: entry.date,
      status: entry.status,
      notes: entry.notes || "",
    });
    setEditingCashflowId(entry.id);
    setCashflowFormError("");
    setShowCashflowForm(true);
  }

  function deleteCashflow(id) {
    updateData((d) => ({ ...d, cashflow: d.cashflow.filter((c) => c.id !== id) }));
  }

  function setBeginningBalance(scope, value) {
    updateData((d) => ({ ...d, beginningBalances: { ...d.beginningBalances, [scope]: value } }));
  }

  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");
  const [askHistory, setAskHistory] = useState([]);

  async function askAssistant() {
    if (!askQuestion.trim() || askLoading) return;
    setAskLoading(true);
    setAskError("");
    setAskAnswer("");
    // The Ask feature called Claude directly from the browser using Claude's own
    // artifact sandbox — that path doesn't exist on a standalone website (there's
    // no API key safely exposed here). Wiring this up for real needs a small
    // server-side function (e.g. a Vercel serverless function) that holds your
    // Anthropic API key and forwards the request. Left disabled until that's built.
    setAskLoading(false);
    setAskError(
      "The Ask feature needs a small backend function to work outside of Claude — it's not wired up yet in this website version."
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("crm_data")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (row && row.data) {
          setData(normalize(row.data));
        }
      } catch (e) {
        // no existing data yet, or fetch failed — start from empty
      } finally {
        setLoaded(true);
      }
    })();
  }, [userId]);

  const persist = useCallback(
    async (next) => {
      try {
        const { error } = await supabase
          .from("crm_data")
          .upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() });
        if (error) throw error;
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (loaded) persist(data);
  }, [data, loaded, persist]);

  function updateData(mutator) {
    setData((prev) => normalize(mutator(normalize(prev))));
  }

  function addClient() {
    try {
      if (!clientForm.name.trim()) {
        setClientFormError("Please enter a name before saving.");
        return;
      }
      setClientFormError("");
      if (editingClientId) {
        updateData((d) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === editingClientId ? { ...c, ...clientForm } : c)),
        }));
        setEditingClientId(null);
      } else {
        const client = { id: uid(), createdAt: todayISO(), ...clientForm };
        updateData((d) => ({ ...d, clients: [...d.clients, client] }));
      }
      setClientForm({ name: "", phone: "", email: "", notes: "" });
      setShowClientForm(false);
    } catch (err) {
      setClientFormError("Something went wrong saving — please try again.");
    }
  }

  function startEditClient(client) {
    setClientForm({ name: client.name, phone: client.phone, email: client.email, notes: client.notes });
    setEditingClientId(client.id);
    setClientFormError("");
    setShowClientForm(true);
  }

  function deleteClient(id) {
    updateData((d) => ({
      clients: d.clients.filter((c) => c.id !== id),
      listings: d.listings.filter((l) => l.clientId !== id),
      followups: d.followups.filter((f) => f.clientId !== id),
      services: d.services.filter((s) => s.clientId !== id),
    }));
    if (selectedClientId === id) setSelectedClientId(null);
  }

  function addListing() {
    if (!listingForm.clientId) {
      setListingFormError("Please select a client.");
      return;
    }
    if (!listingForm.address.trim()) {
      setListingFormError("Please enter a property address.");
      return;
    }
    setListingFormError("");
    if (editingListingId) {
      updateData((d) => ({
        ...d,
        listings: d.listings.map((l) => (l.id === editingListingId ? { ...l, ...listingForm } : l)),
      }));
      setEditingListingId(null);
    } else {
      const listing = { id: uid(), ...listingForm };
      updateData((d) => ({ ...d, listings: [...d.listings, listing] }));
    }
    setListingForm({ clientId: selectedClientId || "", address: "", price: "", status: "Prospecting", notes: "" });
    setShowListingForm(false);
  }

  function startEditListing(listing) {
    setListingForm({
      clientId: listing.clientId,
      address: listing.address,
      price: listing.price,
      status: listing.status,
      notes: listing.notes || "",
    });
    setEditingListingId(listing.id);
    setShowListingForm(true);
  }

  function setListingStatus(id, status) {
    updateData((d) => ({
      ...d,
      listings: d.listings.map((l) => (l.id === id ? { ...l, status } : l)),
    }));
  }

  function deleteListing(id) {
    updateData((d) => ({ ...d, listings: d.listings.filter((l) => l.id !== id) }));
  }

  function addFollowup() {
    if (!followupForm.clientId) {
      setFollowupFormError("Please select a client.");
      return;
    }
    if (!followupForm.note.trim()) {
      setFollowupFormError("Please enter a reminder.");
      return;
    }
    setFollowupFormError("");
    if (editingFollowupId) {
      updateData((d) => ({
        ...d,
        followups: d.followups.map((f) => (f.id === editingFollowupId ? { ...f, ...followupForm } : f)),
      }));
      setEditingFollowupId(null);
    } else {
      const followup = { id: uid(), done: false, ...followupForm };
      updateData((d) => ({ ...d, followups: [...d.followups, followup] }));
    }
    setFollowupForm({ clientId: selectedClientId || "", note: "", dueDate: todayISO(), dueTime: "", notes: "" });
    setShowFollowupForm(false);
  }

  function startEditFollowup(followup) {
    setFollowupForm({
      clientId: followup.clientId,
      note: followup.note,
      dueDate: followup.dueDate,
      dueTime: followup.dueTime || "",
      notes: followup.notes || "",
    });
    setEditingFollowupId(followup.id);
    setShowFollowupForm(true);
  }

  function toggleFollowup(id) {
    updateData((d) => ({
      ...d,
      followups: d.followups.map((f) => (f.id === id ? { ...f, done: !f.done } : f)),
    }));
  }

  function deleteFollowup(id) {
    updateData((d) => ({ ...d, followups: d.followups.filter((f) => f.id !== id) }));
  }

  function addService() {
    if (!serviceForm.clientId) {
      setServiceFormError("Please select a client.");
      return;
    }
    setServiceFormError("");
    if (editingServiceId) {
      updateData((d) => ({
        ...d,
        services: d.services.map((s) => (s.id === editingServiceId ? { ...s, ...serviceForm } : s)),
      }));
      setEditingServiceId(null);
    } else {
      const service = { id: uid(), ...serviceForm };
      updateData((d) => ({ ...d, services: [...d.services, service] }));
    }
    setServiceForm({
      clientId: selectedClientId || "",
      type: SERVICE_TYPES[0],
      fee: "",
      dueDate: todayISO(),
      dueTime: "",
      status: "In progress",
      paymentStatus: "Unpaid",
      notes: "",
    });
    setShowServiceForm(false);
  }

  function startEditService(service) {
    setServiceForm({
      clientId: service.clientId,
      type: service.type,
      fee: service.fee,
      dueDate: service.dueDate,
      dueTime: service.dueTime || "",
      status: service.status,
      paymentStatus: service.paymentStatus,
      notes: service.notes || "",
    });
    setEditingServiceId(service.id);
    setShowServiceForm(true);
  }

  function setServiceStatus(id, status) {
    updateData((d) => ({
      ...d,
      services: d.services.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
  }

  function toggleServicePayment(id) {
    updateData((d) => ({
      ...d,
      services: d.services.map((s) =>
        s.id === id ? { ...s, paymentStatus: s.paymentStatus === "Paid" ? "Unpaid" : "Paid" } : s
      ),
    }));
  }

  function deleteService(id) {
    updateData((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }));
  }

  function addPersonalEvent() {
    if (!personalForm.title.trim()) return;
    if (editingPersonalId) {
      updateData((d) => ({
        ...d,
        personalEvents: d.personalEvents.map((p) =>
          p.id === editingPersonalId ? { ...p, ...personalForm } : p
        ),
      }));
      setEditingPersonalId(null);
    } else {
      const event = { id: uid(), done: false, ...personalForm };
      updateData((d) => ({ ...d, personalEvents: [...d.personalEvents, event] }));
    }
    setPersonalForm({ title: "", date: todayISO(), time: "", notes: "" });
    setShowPersonalForm(false);
  }

  function startEditPersonal(event) {
    setPersonalForm({ title: event.title, date: event.date, time: event.time || "", notes: event.notes || "" });
    setEditingPersonalId(event.id);
    setShowPersonalForm(true);
  }

  function togglePersonalEvent(id) {
    updateData((d) => ({
      ...d,
      personalEvents: d.personalEvents.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    }));
  }

  function deletePersonalEvent(id) {
    updateData((d) => ({ ...d, personalEvents: d.personalEvents.filter((p) => p.id !== id) }));
  }

  function clientName(id) {
    if (!id) return "Personal";
    const c = data.clients.find((c) => c.id === id);
    return c ? c.name : "—";
  }

  const upcomingFollowups = [...data.followups]
    .filter((f) => !f.done)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

  const overdueCount = upcomingFollowups.filter((f) => f.dueDate < todayISO()).length;

  const agendaItems = [
    ...upcomingFollowups.map((f) => ({
      id: "f-" + f.id,
      date: f.dueDate,
      time: f.dueTime,
      label: f.note,
      kind: "Follow-up",
      clientId: f.clientId,
    })),
    ...data.services
      .filter((s) => s.status !== "Completed" && s.dueDate)
      .map((s) => ({
        id: "s-" + s.id,
        date: s.dueDate,
        time: s.dueTime,
        label: s.type,
        kind: "Service",
        clientId: s.clientId,
      })),
    ...data.personalEvents
      .filter((p) => !p.done)
      .map((p) => ({
        id: "p-" + p.id,
        date: p.date,
        time: p.time,
        label: p.title,
        kind: "Personal",
        clientId: null,
      })),
  ].sort((a, b) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (a.time || "").localeCompare(b.time || "");
  });

  const selectedClient = data.clients.find((c) => c.id === selectedClientId);

  const currentYear = todayISO().slice(0, 4);
  const collectionsByYear = {};
  data.services.forEach((s) => {
    const year = s.dueDate ? s.dueDate.slice(0, 4) : "No date";
    if (!collectionsByYear[year]) collectionsByYear[year] = { collected: 0, forCollection: 0 };
    const fee = Number(s.fee) || 0;
    if (s.paymentStatus === "Paid") collectionsByYear[year].collected += fee;
    else collectionsByYear[year].forCollection += fee;
  });
  const collectionYears = Object.keys(collectionsByYear).sort((a, b) => b.localeCompare(a));

  const ink = "#25313D";
  const paper = "#F7F3EA";
  const brass = "#A9822F";
  const brick = "#B5502D";
  const line = "#D8D0BC";
  const cardBg = "#FFFDF8";

  const styles = {
    page: {
      fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
      background: paper,
      color: ink,
      minHeight: "100%",
      padding: "0",
      maxWidth: 900,
      margin: "0 auto",
    },
    header: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "20px 20px 14px",
      borderBottom: `2px solid ${ink}`,
    },
    brand: { fontSize: 22, fontWeight: 700, letterSpacing: "0.01em" },
    tagline: {
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      color: "#6B6252",
      marginTop: 2,
    },
    nav: {
      display: "flex",
      gap: 0,
      borderBottom: `1px solid ${line}`,
      background: "#EFE9D9",
    },
    navBtn: (active) => ({
      flex: 1,
      padding: "10px 8px",
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      border: "none",
      borderRight: `1px solid ${line}`,
      background: active ? cardBg : "transparent",
      color: active ? ink : "#8A8069",
      borderBottom: active ? `2px solid ${brass}` : "2px solid transparent",
      cursor: "pointer",
    }),
    body: { padding: "16px 20px 40px" },
    sectionHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    h2: { fontSize: 17, fontWeight: 700, margin: 0 },
    addBtn: {
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      background: ink,
      color: paper,
      border: "none",
      padding: "7px 12px",
      cursor: "pointer",
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: cardBg,
      border: `1px solid ${line}`,
      borderBottom: "none",
    },
    rowLast: { borderBottom: `1px solid ${line}` },
    formCard: {
      background: cardBg,
      border: `1px solid ${line}`,
      padding: 14,
      marginBottom: 14,
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      fontFamily: "inherit",
      fontSize: 14,
      padding: "8px 10px",
      border: `1px solid ${line}`,
      background: "#FDFBF5",
      color: ink,
      marginBottom: 8,
    },
    label: {
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      color: "#8A8069",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      display: "block",
      marginBottom: 3,
    },
    smallBtn: {
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      background: "transparent",
      border: `1px solid ${ink}`,
      color: ink,
      padding: "5px 9px",
      cursor: "pointer",
    },
    empty: {
      padding: "30px 14px",
      textAlign: "center",
      color: "#8A8069",
      border: `1px dashed ${line}`,
      background: cardBg,
      fontSize: 14,
    },
    pill: (s) => ({
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 2,
      background: STATUS_COLOR[s].bg,
      color: STATUS_COLOR[s].text,
      border: `1px solid ${STATUS_COLOR[s].border}`,
    }),
    servicePill: (s) => ({
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 2,
      background: SERVICE_STATUS_COLOR[s].bg,
      color: SERVICE_STATUS_COLOR[s].text,
      border: `1px solid ${SERVICE_STATUS_COLOR[s].border}`,
    }),
  };

  if (!loaded) {
    return (
      <div style={{ ...styles.page, padding: 40, textAlign: "center", color: "#8A8069" }}>
        Loading ledger…
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>RV2 Advisory & Real Estate Corp.</div>
          <div style={styles.tagline}>
            client ledger · {data.clients.length} client{data.clients.length === 1 ? "" : "s"} ·{" "}
            {data.listings.length} listing{data.listings.length === 1 ? "" : "s"} ·{" "}
            {data.services.length} service{data.services.length === 1 ? "" : "s"}
            {overdueCount > 0 ? ` · ${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `2px solid ${ink}` }}>
        <button
          onClick={() => {
            setMode("business");
            setTab("clients");
          }}
          style={{
            flex: 1,
            padding: "8px",
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "none",
            background: mode === "business" ? ink : "#EFE9D9",
            color: mode === "business" ? paper : "#8A8069",
            cursor: "pointer",
          }}
        >
          Business CRM
        </button>
        <button
          onClick={() => {
            setMode("personal");
            setTab("personal");
          }}
          style={{
            flex: 1,
            padding: "8px",
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "none",
            background: mode === "personal" ? ink : "#EFE9D9",
            color: mode === "personal" ? paper : "#8A8069",
            cursor: "pointer",
          }}
        >
          Personal
        </button>
      </div>

      {mode === "business" ? (
        <div style={styles.nav}>
          {["clients", "pipeline", "services", "followups", "agenda", "collections", "reports", "assets", "liabilities", "cashflow", "statements", "ask"].map((t) => (
            <button key={t} style={styles.navBtn(tab === t)} onClick={() => setTab(t)}>
              {t === "clients"
                ? "Clients"
                : t === "pipeline"
                ? "Pipeline"
                : t === "services"
                ? "Services"
                : t === "followups"
                ? "Follow-ups"
                : t === "agenda"
                ? "Agenda"
                : t === "collections"
                ? "Collections"
                : t === "reports"
                ? "Reports"
                : t === "assets"
                ? "Assets"
                : t === "liabilities"
                ? "Liabilities"
                : t === "cashflow"
                ? "Cash Flow"
                : t === "statements"
                ? "Statements"
                : "Ask"}
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.nav}>
          {["personal", "assets", "liabilities", "cashflow", "statements"].map((t) => (
            <button key={t} style={styles.navBtn(tab === t)} onClick={() => setTab(t)}>
              {t === "personal"
                ? "Personal"
                : t === "assets"
                ? "Assets"
                : t === "liabilities"
                ? "Liabilities"
                : t === "cashflow"
                ? "Cash Flow"
                : "Statements"}
            </button>
          ))}
        </div>
      )}

      <div style={styles.body}>
        {saveError && (
          <div style={{ ...styles.empty, borderColor: brick, color: brick, marginBottom: 14 }}>
            Couldn't save changes. They'll be lost if you close this — try again in a moment.
          </div>
        )}

        {tab === "clients" && (
          <ClientsView
            styles={styles}
            data={data}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            selectedClient={selectedClient}
            showClientForm={showClientForm}
            setShowClientForm={setShowClientForm}
            clientForm={clientForm}
            setClientForm={setClientForm}
            clientFormError={clientFormError}
            setClientFormError={setClientFormError}
            addClient={addClient}
            deleteClient={deleteClient}
            toggleServicePayment={toggleServicePayment}
            editingClientId={editingClientId}
            setEditingClientId={setEditingClientId}
            startEditClient={startEditClient}
            startEditListing={startEditListing}
            startEditService={startEditService}
            startEditFollowup={startEditFollowup}
            brick={brick}
          />
        )}

        {tab === "pipeline" && (
          <PipelineView
            styles={styles}
            data={data}
            showListingForm={showListingForm}
            setShowListingForm={setShowListingForm}
            listingForm={listingForm}
            setListingForm={setListingForm}
            listingFormError={listingFormError}
            setListingFormError={setListingFormError}
            addListing={addListing}
            setListingStatus={setListingStatus}
            deleteListing={deleteListing}
            clientName={clientName}
            editingListingId={editingListingId}
            setEditingListingId={setEditingListingId}
            startEditListing={startEditListing}
            brick={brick}
          />
        )}

        {tab === "services" && (
          <ServicesView
            styles={styles}
            data={data}
            showServiceForm={showServiceForm}
            setShowServiceForm={setShowServiceForm}
            serviceForm={serviceForm}
            setServiceForm={setServiceForm}
            serviceFormError={serviceFormError}
            setServiceFormError={setServiceFormError}
            addService={addService}
            setServiceStatus={setServiceStatus}
            toggleServicePayment={toggleServicePayment}
            deleteService={deleteService}
            clientName={clientName}
            editingServiceId={editingServiceId}
            setEditingServiceId={setEditingServiceId}
            startEditService={startEditService}
            brick={brick}
          />
        )}

        {tab === "followups" && (
          <FollowupsView
            styles={styles}
            data={data}
            upcomingFollowups={upcomingFollowups}
            showFollowupForm={showFollowupForm}
            setShowFollowupForm={setShowFollowupForm}
            followupForm={followupForm}
            setFollowupForm={setFollowupForm}
            followupFormError={followupFormError}
            setFollowupFormError={setFollowupFormError}
            addFollowup={addFollowup}
            toggleFollowup={toggleFollowup}
            deleteFollowup={deleteFollowup}
            clientName={clientName}
            editingFollowupId={editingFollowupId}
            setEditingFollowupId={setEditingFollowupId}
            startEditFollowup={startEditFollowup}
            brick={brick}
          />
        )}

        {tab === "personal" && (
          <PersonalView
            styles={styles}
            data={data}
            showPersonalForm={showPersonalForm}
            setShowPersonalForm={setShowPersonalForm}
            personalForm={personalForm}
            setPersonalForm={setPersonalForm}
            addPersonalEvent={addPersonalEvent}
            togglePersonalEvent={togglePersonalEvent}
            deletePersonalEvent={deletePersonalEvent}
            editingPersonalId={editingPersonalId}
            setEditingPersonalId={setEditingPersonalId}
            startEditPersonal={startEditPersonal}
            brick={brick}
          />
        )}

        {tab === "agenda" && (
          <AgendaView styles={styles} agendaItems={agendaItems} clientName={clientName} brick={brick} />
        )}

        {tab === "collections" && (
          <CollectionsView
            styles={styles}
            collectionsByYear={collectionsByYear}
            collectionYears={collectionYears}
            currentYear={currentYear}
            services={data.services}
            clientName={clientName}
            brick={brick}
          />
        )}

        {tab === "reports" && (
          <ReportsView styles={styles} data={data} clientName={clientName} brick={brick} />
        )}

        {tab === "ask" && (
          <AskView
            styles={styles}
            askQuestion={askQuestion}
            setAskQuestion={setAskQuestion}
            askAnswer={askAnswer}
            askLoading={askLoading}
            askError={askError}
            askHistory={askHistory}
            askAssistant={askAssistant}
            brick={brick}
          />
        )}

        {tab === "assets" && (
          <AssetsView
            styles={styles}
            data={data}
            financeScope={effectiveFinanceScope}
            showAssetForm={showAssetForm}
            setShowAssetForm={setShowAssetForm}
            assetForm={assetForm}
            setAssetForm={setAssetForm}
            assetFormError={assetFormError}
            setAssetFormError={setAssetFormError}
            addAsset={addAsset}
            editingAssetId={editingAssetId}
            setEditingAssetId={setEditingAssetId}
            startEditAsset={startEditAsset}
            deleteAsset={deleteAsset}
            brick={brick}
          />
        )}

        {tab === "liabilities" && (
          <LiabilitiesView
            styles={styles}
            data={data}
            financeScope={effectiveFinanceScope}
            showLiabilityForm={showLiabilityForm}
            setShowLiabilityForm={setShowLiabilityForm}
            liabilityForm={liabilityForm}
            setLiabilityForm={setLiabilityForm}
            liabilityFormError={liabilityFormError}
            setLiabilityFormError={setLiabilityFormError}
            addLiability={addLiability}
            editingLiabilityId={editingLiabilityId}
            setEditingLiabilityId={setEditingLiabilityId}
            startEditLiability={startEditLiability}
            deleteLiability={deleteLiability}
            brick={brick}
          />
        )}

        {tab === "cashflow" && (
          <CashflowView
            styles={styles}
            data={data}
            financeScope={effectiveFinanceScope}
            beginningBalance={data.beginningBalances[effectiveFinanceScope]}
            setBeginningBalance={setBeginningBalance}
            showCashflowForm={showCashflowForm}
            setShowCashflowForm={setShowCashflowForm}
            cashflowForm={cashflowForm}
            setCashflowForm={setCashflowForm}
            cashflowFormError={cashflowFormError}
            setCashflowFormError={setCashflowFormError}
            addCashflow={addCashflow}
            editingCashflowId={editingCashflowId}
            setEditingCashflowId={setEditingCashflowId}
            startEditCashflow={startEditCashflow}
            deleteCashflow={deleteCashflow}
            brick={brick}
          />
        )}

        {tab === "statements" && (
          <StatementsView styles={styles} data={data} financeScope={effectiveFinanceScope} brick={brick} />
        )}
      </div>
    </div>
  );
}

function ClientsView({
  styles, data, selectedClientId, setSelectedClientId, selectedClient,
  showClientForm, setShowClientForm, clientForm, setClientForm,
  clientFormError, setClientFormError, addClient, deleteClient, toggleServicePayment,
  editingClientId, setEditingClientId, startEditClient, startEditListing, startEditService, startEditFollowup,
  brick,
}) {
  if (selectedClient) {
    const listings = data.listings.filter((l) => l.clientId === selectedClient.id);
    const followups = data.followups.filter((f) => f.clientId === selectedClient.id);
    const services = data.services.filter((s) => s.clientId === selectedClient.id);
    return (
      <div>
        <button style={styles.smallBtn} onClick={() => setSelectedClientId(null)}>
          ← back to clients
        </button>
        <div style={{ ...styles.formCard, marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedClient.name}</div>
          {selectedClient.phone && <div style={{ fontSize: 13, color: "#6B6252" }}>{selectedClient.phone}</div>}
          {selectedClient.email && <div style={{ fontSize: 13, color: "#6B6252" }}>{selectedClient.email}</div>}
          {selectedClient.notes && (
            <div style={{ fontSize: 13, marginTop: 8, borderTop: `1px solid ${styles.formCard.borderColor || "#D8D0BC"}`, paddingTop: 8 }}>
              {selectedClient.notes}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button style={styles.smallBtn} onClick={() => startEditClient(selectedClient)}>
              edit client
            </button>
            <button
              style={{ ...styles.smallBtn, borderColor: brick, color: brick }}
              onClick={() => deleteClient(selectedClient.id)}
            >
              remove client
            </button>
          </div>
        </div>

        <div style={styles.h2}>Listings</div>
        <div style={{ marginBottom: 18, marginTop: 8 }}>
          {listings.length === 0 ? (
            <div style={styles.empty}>No listings for this client yet.</div>
          ) : (
            listings.map((l, i) => (
              <div key={l.id} style={{ ...styles.row, ...(i === listings.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{l.address}</div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069" }}>
                    {formatMoney(l.price)}
                  </div>
                  {l.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{l.notes}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={styles.pill(l.status)}>{l.status}</span>
                  <button style={styles.smallBtn} onClick={() => startEditListing(l)}>edit</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.h2}>Services</div>
        {services.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ ...styles.formCard, flex: 1, textAlign: "center", padding: "10px 8px" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#8A8069", textTransform: "uppercase", marginBottom: 4 }}>
                Collected
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#3F5A33" }}>
                {formatMoney(services.filter((s) => s.paymentStatus === "Paid").reduce((sum, s) => sum + (Number(s.fee) || 0), 0)) || "₱0"}
              </div>
            </div>
            <div style={{ ...styles.formCard, flex: 1, textAlign: "center", padding: "10px 8px" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#8A8069", textTransform: "uppercase", marginBottom: 4 }}>
                Total (all services)
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#25313D" }}>
                {formatMoney(services.reduce((sum, s) => sum + (Number(s.fee) || 0), 0)) || "₱0"}
              </div>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 18, marginTop: 8 }}>
          {services.length === 0 ? (
            <div style={styles.empty}>No services for this client yet.</div>
          ) : (
            services.map((s, i) => (
              <div key={s.id} style={{ ...styles.row, ...(i === services.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{s.type}</div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069" }}>
                    {formatMoney(s.fee)} · due {formatDateTime(s.dueDate, s.dueTime)}
                  </div>
                  {s.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{s.notes}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={styles.servicePill(s.status)}>{s.status}</span>
                  <button
                    style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 2,
                      cursor: "pointer",
                      background: s.paymentStatus === "Paid" ? "#DCE6D6" : "#F0DED3",
                      color: s.paymentStatus === "Paid" ? "#3F5A33" : "#7A3E1E",
                      border: `1px solid ${s.paymentStatus === "Paid" ? "#7FA168" : "#C8763E"}`,
                    }}
                    onClick={() => toggleServicePayment(s.id)}
                  >
                    {s.paymentStatus}
                  </button>
                  <button style={styles.smallBtn} onClick={() => startEditService(s)}>edit</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.h2}>Follow-ups</div>
        <div style={{ marginTop: 8 }}>
          {followups.length === 0 ? (
            <div style={styles.empty}>No follow-ups for this client yet.</div>
          ) : (
            followups.map((f, i) => (
              <div key={f.id} style={{ ...styles.row, ...(i === followups.length - 1 ? styles.rowLast : {}) }}>
                <div style={{ textDecoration: f.done ? "line-through" : "none", color: f.done ? "#8A8069" : styles.body.color }}>
                  <div style={{ fontSize: 14 }}>{f.note}</div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069" }}>
                    {formatDateTime(f.dueDate, f.dueTime)}
                  </div>
                  {f.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{f.notes}</div>
                  )}
                </div>
                <button style={styles.smallBtn} onClick={() => startEditFollowup(f)}>edit</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Clients</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showClientForm) {
              setEditingClientId(null);
              setClientForm({ name: "", phone: "", email: "", notes: "" });
            }
            setShowClientForm((s) => !s);
          }}
        >
          {showClientForm ? "cancel" : "+ add client"}
        </button>
      </div>

      {showClientForm && (
        <div style={styles.formCard}>
          {clientFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {clientFormError}
            </div>
          )}
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={clientForm.name}
            onChange={(e) => {
              setClientForm({ ...clientForm, name: e.target.value });
              if (clientFormError) setClientFormError("");
            }}
            placeholder="Maria Santos"
          />
          <label style={styles.label}>Phone</label>
          <input
            style={styles.input}
            value={clientForm.phone}
            onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
            placeholder="+63 917 000 0000"
          />
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            value={clientForm.email}
            onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
            placeholder="maria@email.com"
          />
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={clientForm.notes}
            onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
            placeholder="Looking for a 2BR in Makati, budget 8M"
          />
          <button style={styles.addBtn} onClick={addClient}>
            {editingClientId ? "update client" : "save client"}
          </button>
        </div>
      )}

      {data.clients.length === 0 ? (
        <div style={styles.empty}>No clients yet. Add your first one above.</div>
      ) : (
        data.clients.map((c, i) => (
          <div
            key={c.id}
            style={{ ...styles.row, ...(i === data.clients.length - 1 ? styles.rowLast : {}) }}
          >
            <div style={{ cursor: "pointer", flex: 1 }} onClick={() => setSelectedClientId(c.id)}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#8A8069" }}>{c.phone || c.email || "no contact info"}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button style={styles.smallBtn} onClick={() => startEditClient(c)}>edit</button>
              <span
                style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", cursor: "pointer" }}
                onClick={() => setSelectedClientId(c.id)}
              >
                →
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PipelineView({
  styles, data, showListingForm, setShowListingForm, listingForm, setListingForm,
  listingFormError, setListingFormError,
  addListing, setListingStatus, deleteListing, clientName,
  editingListingId, setEditingListingId, startEditListing, brick,
}) {
  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Pipeline</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showListingForm) {
              setEditingListingId(null);
              setListingForm({ clientId: "", address: "", price: "", status: "Prospecting", notes: "" });
              setListingFormError("");
            }
            setShowListingForm((s) => !s);
          }}
          disabled={data.clients.length === 0}
        >
          {showListingForm ? "cancel" : "+ add listing"}
        </button>
      </div>

      {data.clients.length === 0 && (
        <div style={styles.empty}>Add a client first — listings attach to a client.</div>
      )}

      {showListingForm && (
        <div style={styles.formCard}>
          {listingFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {listingFormError}
            </div>
          )}
          <label style={styles.label}>Client</label>
          <select
            style={styles.input}
            value={listingForm.clientId}
            onChange={(e) => setListingForm({ ...listingForm, clientId: e.target.value })}
          >
            <option value="">Select a client…</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label style={styles.label}>Property address</label>
          <input
            style={styles.input}
            value={listingForm.address}
            onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })}
            placeholder="123 Wilson St, San Juan"
          />
          <label style={styles.label}>Price</label>
          <input
            style={styles.input}
            type="number"
            value={listingForm.price}
            onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}
            placeholder="8500000"
          />
          <label style={styles.label}>Status</label>
          <select
            style={styles.input}
            value={listingForm.status}
            onChange={(e) => setListingForm({ ...listingForm, status: e.target.value })}
          >
            {STATUS_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={listingForm.notes}
            onChange={(e) => setListingForm({ ...listingForm, notes: e.target.value })}
            placeholder="Optional — e.g. seller open to price negotiation"
          />
          <button style={styles.addBtn} onClick={addListing}>
            {editingListingId ? "update listing" : "save listing"}
          </button>
        </div>
      )}

      {STATUS_STAGES.map((stage) => {
        const items = data.listings.filter((l) => l.status === stage);
        if (items.length === 0) return null;
        return (
          <div key={stage} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {stage} ({items.length})
            </div>
            {items.map((l, i) => (
              <div key={l.id} style={{ ...styles.row, ...(i === items.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{l.address}</div>
                  <div style={{ fontSize: 12, color: "#8A8069" }}>
                    {clientName(l.clientId)} · {formatMoney(l.price)}
                  </div>
                  {l.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{l.notes}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    style={{ ...styles.smallBtn, padding: "4px 6px" }}
                    value={l.status}
                    onChange={(e) => setListingStatus(l.id, e.target.value)}
                  >
                    {STATUS_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button style={styles.smallBtn} onClick={() => startEditListing(l)}>edit</button>
                  <button
                    style={{ ...styles.smallBtn, borderColor: brick, color: brick }}
                    onClick={() => deleteListing(l.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {data.listings.length === 0 && data.clients.length > 0 && (
        <div style={styles.empty}>No listings yet. Add your first one above.</div>
      )}
    </div>
  );
}

function FollowupsView({
  styles, data, upcomingFollowups, showFollowupForm, setShowFollowupForm,
  followupForm, setFollowupForm, followupFormError, setFollowupFormError,
  addFollowup, toggleFollowup, deleteFollowup, clientName,
  editingFollowupId, setEditingFollowupId, startEditFollowup, brick,
}) {
  const done = data.followups.filter((f) => f.done);
  const today = todayISO();

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Follow-ups</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showFollowupForm) {
              setEditingFollowupId(null);
              setFollowupForm({ clientId: "", note: "", dueDate: todayISO(), dueTime: "", notes: "" });
              setFollowupFormError("");
            }
            setShowFollowupForm((s) => !s);
          }}
          disabled={data.clients.length === 0}
        >
          {showFollowupForm ? "cancel" : "+ add follow-up"}
        </button>
      </div>

      {data.clients.length === 0 && (
        <div style={styles.empty}>Add a client first — follow-ups attach to a client.</div>
      )}

      {showFollowupForm && (
        <div style={styles.formCard}>
          {followupFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {followupFormError}
            </div>
          )}
          <label style={styles.label}>Client</label>
          <select
            style={styles.input}
            value={followupForm.clientId}
            onChange={(e) => setFollowupForm({ ...followupForm, clientId: e.target.value })}
          >
            <option value="">Select a client…</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label style={styles.label}>Reminder</label>
          <input
            style={styles.input}
            value={followupForm.note}
            onChange={(e) => setFollowupForm({ ...followupForm, note: e.target.value })}
            placeholder="Call about revised offer"
          />
          <label style={styles.label}>Due date</label>
          <input
            style={styles.input}
            type="date"
            value={followupForm.dueDate}
            onChange={(e) => setFollowupForm({ ...followupForm, dueDate: e.target.value })}
          />
          <label style={styles.label}>Time (optional)</label>
          <input
            style={styles.input}
            type="time"
            value={followupForm.dueTime}
            onChange={(e) => setFollowupForm({ ...followupForm, dueTime: e.target.value })}
          />
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={followupForm.notes}
            onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })}
            placeholder="Optional — additional context or updates"
          />
          <button style={styles.addBtn} onClick={addFollowup}>
            {editingFollowupId ? "update follow-up" : "save follow-up"}
          </button>
        </div>
      )}

      {upcomingFollowups.length === 0 ? (
        <div style={styles.empty}>Nothing pending.</div>
      ) : (
        upcomingFollowups.map((f, i) => {
          const overdue = f.dueDate && f.dueDate < today;
          return (
            <div key={f.id} style={{ ...styles.row, ...(i === upcomingFollowups.length - 1 ? styles.rowLast : {}) }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={false} onChange={() => toggleFollowup(f.id)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 14 }}>{f.note}</div>
                  <div style={{ fontSize: 12, color: overdue ? brick : "#8A8069" }}>
                    {clientName(f.clientId)} · {formatDateTime(f.dueDate, f.dueTime)}{overdue ? " · overdue" : ""}
                  </div>
                  {f.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{f.notes}</div>
                  )}
                </div>
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.smallBtn} onClick={() => startEditFollowup(f)}>edit</button>
                <button style={styles.smallBtn} onClick={() => deleteFollowup(f.id)}>remove</button>
              </div>
            </div>
          );
        })
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase" }}>
            Completed ({done.length})
          </div>
          {done.map((f, i) => (
            <div key={f.id} style={{ ...styles.row, ...(i === done.length - 1 ? styles.rowLast : {}), opacity: 0.6 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={true} onChange={() => toggleFollowup(f.id)} style={{ marginTop: 3 }} />
                <div style={{ textDecoration: "line-through" }}>
                  <div style={{ fontSize: 14 }}>{f.note}</div>
                  <div style={{ fontSize: 12, color: "#8A8069" }}>{clientName(f.clientId)} · {formatDateTime(f.dueDate, f.dueTime)}</div>
                </div>
              </label>
              <button style={styles.smallBtn} onClick={() => deleteFollowup(f.id)}>remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServicesView({
  styles, data, showServiceForm, setShowServiceForm, serviceForm, setServiceForm,
  serviceFormError, setServiceFormError,
  addService, setServiceStatus, toggleServicePayment, deleteService, clientName,
  editingServiceId, setEditingServiceId, startEditService, brick,
}) {
  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Services</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showServiceForm) {
              setEditingServiceId(null);
              setServiceForm({
                clientId: "",
                type: SERVICE_TYPES[0],
                fee: "",
                dueDate: todayISO(),
                dueTime: "",
                status: "In progress",
                paymentStatus: "Unpaid",
                notes: "",
              });
              setServiceFormError("");
            }
            setShowServiceForm((s) => !s);
          }}
          disabled={data.clients.length === 0}
        >
          {showServiceForm ? "cancel" : "+ add service"}
        </button>
      </div>

      {data.clients.length === 0 && (
        <div style={styles.empty}>Add a client first — services attach to a client.</div>
      )}

      {showServiceForm && (
        <div style={styles.formCard}>
          {serviceFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {serviceFormError}
            </div>
          )}
          <label style={styles.label}>Client</label>
          <select
            style={styles.input}
            value={serviceForm.clientId}
            onChange={(e) => setServiceForm({ ...serviceForm, clientId: e.target.value })}
          >
            <option value="">Select a client…</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label style={styles.label}>Service type</label>
          <select
            style={styles.input}
            value={serviceForm.type}
            onChange={(e) => setServiceForm({ ...serviceForm, type: e.target.value })}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label style={styles.label}>Fee</label>
          <input
            style={styles.input}
            type="number"
            value={serviceForm.fee}
            onChange={(e) => setServiceForm({ ...serviceForm, fee: e.target.value })}
            placeholder="15000"
          />
          <label style={styles.label}>Due date</label>
          <input
            style={styles.input}
            type="date"
            value={serviceForm.dueDate}
            onChange={(e) => setServiceForm({ ...serviceForm, dueDate: e.target.value })}
          />
          <label style={styles.label}>Time (optional)</label>
          <input
            style={styles.input}
            type="time"
            value={serviceForm.dueTime}
            onChange={(e) => setServiceForm({ ...serviceForm, dueTime: e.target.value })}
          />
          <label style={styles.label}>Status</label>
          <select
            style={styles.input}
            value={serviceForm.status}
            onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}
          >
            {SERVICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label style={styles.label}>Payment status</label>
          <select
            style={styles.input}
            value={serviceForm.paymentStatus}
            onChange={(e) => setServiceForm({ ...serviceForm, paymentStatus: e.target.value })}
          >
            <option value="Unpaid">Unpaid</option>
            <option value="Paid">Paid</option>
          </select>
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={serviceForm.notes}
            onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
            placeholder="Optional — e.g. waiting on notarized SPA from client"
          />
          <button style={styles.addBtn} onClick={addService}>
            {editingServiceId ? "update service" : "save service"}
          </button>
        </div>
      )}

      {SERVICE_TYPES.map((type) => {
        const items = data.services.filter((s) => s.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {type} ({items.length})
            </div>
            {items.map((s, i) => (
              <div key={s.id} style={{ ...styles.row, ...(i === items.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{clientName(s.clientId)}</div>
                  <div style={{ fontSize: 12, color: "#8A8069" }}>
                    {formatMoney(s.fee)} · due {formatDateTime(s.dueDate, s.dueTime)}
                  </div>
                  {s.notes && (
                    <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic", marginTop: 2 }}>{s.notes}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    style={{ ...styles.smallBtn, padding: "4px 6px" }}
                    value={s.status}
                    onChange={(e) => setServiceStatus(s.id, e.target.value)}
                  >
                    {SERVICE_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <button
                    style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 2,
                      cursor: "pointer",
                      background: s.paymentStatus === "Paid" ? "#DCE6D6" : "#F0DED3",
                      color: s.paymentStatus === "Paid" ? "#3F5A33" : "#7A3E1E",
                      border: `1px solid ${s.paymentStatus === "Paid" ? "#7FA168" : "#C8763E"}`,
                    }}
                    onClick={() => toggleServicePayment(s.id)}
                  >
                    {s.paymentStatus}
                  </button>
                  <button style={styles.smallBtn} onClick={() => startEditService(s)}>edit</button>
                  <button
                    style={{ ...styles.smallBtn, borderColor: brick, color: brick }}
                    onClick={() => deleteService(s.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {data.services.length === 0 && data.clients.length > 0 && (
        <div style={styles.empty}>No services yet. Add your first one above.</div>
      )}
    </div>
  );
}

function AgendaView({ styles, agendaItems, clientName, brick }) {
  const today = todayISO();

  if (agendaItems.length === 0) {
    return <div style={styles.empty}>Nothing on the agenda — no open follow-ups or service deadlines.</div>;
  }

  const groups = [];
  for (const item of agendaItems) {
    const dateLabel = formatDate(item.date) || "No date";
    let group = groups.find((g) => g.dateLabel === dateLabel);
    if (!group) {
      group = { dateLabel, date: item.date, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div>
      <h2 style={{ ...styles.h2, marginBottom: 12 }}>Agenda</h2>
      {groups.map((group, gi) => {
        const overdue = group.date && group.date < today;
        return (
          <div key={group.dateLabel + gi} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: overdue ? brick : "#8A8069",
              }}
            >
              {group.dateLabel}{overdue ? " · overdue" : ""}
            </div>
            {group.items.map((item, i) => (
              <div
                key={item.id}
                style={{ ...styles.row, ...(i === group.items.length - 1 ? styles.rowLast : {}) }}
              >
                <div>
                  <div style={{ fontSize: 14 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#8A8069" }}>
                    {clientName(item.clientId)}{item.time ? " · " + formatTime(item.time) : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 2,
                    background:
                      item.kind === "Follow-up" ? "#EFE6D3" : item.kind === "Service" ? "#DCE6D6" : "#F0DED3",
                    color:
                      item.kind === "Follow-up" ? "#6B5122" : item.kind === "Service" ? "#3F5A33" : "#7A3E1E",
                    border: `1px solid ${
                      item.kind === "Follow-up" ? "#C9A54B" : item.kind === "Service" ? "#7FA168" : "#C8763E"
                    }`,
                  }}
                >
                  {item.kind}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PersonalView({
  styles, data, showPersonalForm, setShowPersonalForm, personalForm, setPersonalForm,
  addPersonalEvent, togglePersonalEvent, deletePersonalEvent,
  editingPersonalId, setEditingPersonalId, startEditPersonal, brick,
}) {
  const upcoming = [...data.personalEvents]
    .filter((p) => !p.done)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const done = data.personalEvents.filter((p) => p.done);
  const today = todayISO();

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>Personal</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showPersonalForm) {
              setEditingPersonalId(null);
              setPersonalForm({ title: "", date: todayISO(), time: "", notes: "" });
            }
            setShowPersonalForm((s) => !s);
          }}
        >
          {showPersonalForm ? "cancel" : "+ add personal event"}
        </button>
      </div>

      {showPersonalForm && (
        <div style={styles.formCard}>
          <label style={styles.label}>Title</label>
          <input
            style={styles.input}
            value={personalForm.title}
            onChange={(e) => setPersonalForm({ ...personalForm, title: e.target.value })}
            placeholder="Dentist appointment"
          />
          <label style={styles.label}>Date</label>
          <input
            style={styles.input}
            type="date"
            value={personalForm.date}
            onChange={(e) => setPersonalForm({ ...personalForm, date: e.target.value })}
          />
          <label style={styles.label}>Time (optional)</label>
          <input
            style={styles.input}
            type="time"
            value={personalForm.time}
            onChange={(e) => setPersonalForm({ ...personalForm, time: e.target.value })}
          />
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={personalForm.notes}
            onChange={(e) => setPersonalForm({ ...personalForm, notes: e.target.value })}
            placeholder="Optional"
          />
          <button style={styles.addBtn} onClick={addPersonalEvent}>
            {editingPersonalId ? "update event" : "save event"}
          </button>
        </div>
      )}

      {upcoming.length === 0 ? (
        <div style={styles.empty}>Nothing personal scheduled.</div>
      ) : (
        upcoming.map((p, i) => {
          const overdue = p.date && p.date < today;
          return (
            <div key={p.id} style={{ ...styles.row, ...(i === upcoming.length - 1 ? styles.rowLast : {}) }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={false} onChange={() => togglePersonalEvent(p.id)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: overdue ? brick : "#8A8069" }}>
                    {formatDateTime(p.date, p.time)}{overdue ? " · overdue" : ""}{p.notes ? " · " + p.notes : ""}
                  </div>
                </div>
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.smallBtn} onClick={() => startEditPersonal(p)}>edit</button>
                <button style={styles.smallBtn} onClick={() => deletePersonalEvent(p.id)}>remove</button>
              </div>
            </div>
          );
        })
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase" }}>
            Completed ({done.length})
          </div>
          {done.map((p, i) => (
            <div key={p.id} style={{ ...styles.row, ...(i === done.length - 1 ? styles.rowLast : {}), opacity: 0.6 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={true} onChange={() => togglePersonalEvent(p.id)} style={{ marginTop: 3 }} />
                <div style={{ textDecoration: "line-through" }}>
                  <div style={{ fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "#8A8069" }}>{formatDateTime(p.date, p.time)}</div>
                </div>
              </label>
              <button style={styles.smallBtn} onClick={() => deletePersonalEvent(p.id)}>remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AskView({
  styles, askQuestion, setAskQuestion, askAnswer, askLoading, askError, askHistory, askAssistant, brick,
}) {
  return (
    <div>
      <h2 style={{ ...styles.h2, marginBottom: 4 }}>Ask</h2>
      <div style={{ fontSize: 12, color: "#8A8069", marginBottom: 12 }}>
        Ask about your clients, services, fees, or schedule — answers use whatever's currently in the CRM.
      </div>

      <div style={styles.formCard}>
        <textarea
          style={{ ...styles.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
          value={askQuestion}
          onChange={(e) => setAskQuestion(e.target.value)}
          placeholder="e.g. Who do I need to follow up with this week? Which services are unpaid?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              askAssistant();
            }
          }}
        />
        <button style={styles.addBtn} onClick={askAssistant} disabled={askLoading}>
          {askLoading ? "asking…" : "ask"}
        </button>
      </div>

      {askError && (
        <div style={{ ...styles.empty, borderColor: brick, color: brick, marginBottom: 14 }}>{askError}</div>
      )}

      {askLoading && <div style={styles.empty}>Thinking…</div>}

      {askAnswer && !askLoading && (
        <div style={{ ...styles.formCard, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
          {askAnswer}
        </div>
      )}

      {askHistory.length > 1 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase" }}>
            Recent
          </div>
          {askHistory.slice(1).map((h, i) => (
            <div key={i} style={{ ...styles.row, ...(i === askHistory.length - 2 ? styles.rowLast : {}), flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{h.question}</div>
              <div style={{ fontSize: 13, color: "#6B6252", whiteSpace: "pre-wrap" }}>{h.answer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionsView({ styles, collectionsByYear, collectionYears, currentYear, services, clientName, brick }) {
  const currentTotals = collectionsByYear[currentYear] || { collected: 0, forCollection: 0 };
  const otherYears = collectionYears.filter((y) => y !== currentYear);

  const currentYearServices = services.filter((s) => (s.dueDate ? s.dueDate.slice(0, 4) : "No date") === currentYear);
  const paidThisYear = currentYearServices.filter((s) => s.paymentStatus === "Paid");
  const unpaidThisYear = currentYearServices.filter((s) => s.paymentStatus !== "Paid");

  const statCard = (label, amount, color) => (
    <div style={{ ...styles.formCard, flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{formatMoney(amount) || "₱0"}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ ...styles.h2, marginBottom: 4 }}>Collections</h2>
      <div style={{ fontSize: 12, color: "#8A8069", marginBottom: 14 }}>
        Based on service fees, grouped by due date year. Resets automatically each new year.
      </div>

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {currentYear} — Year to Date
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {statCard("Collected", currentTotals.collected, "#3F5A33")}
        {statCard("For Collection", currentTotals.forCollection, "#7A3E1E")}
        {statCard("Total", currentTotals.collected + currentTotals.forCollection, "#25313D")}
      </div>

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Paid ({paidThisYear.length})
      </div>
      <div style={{ marginBottom: 20 }}>
        {paidThisYear.length === 0 ? (
          <div style={styles.empty}>No payments received yet this year.</div>
        ) : (
          paidThisYear.map((s, i) => (
            <div key={s.id} style={{ ...styles.row, ...(i === paidThisYear.length - 1 ? styles.rowLast : {}) }}>
              <div>
                <div style={{ fontSize: 14 }}>{clientName(s.clientId)}</div>
                <div style={{ fontSize: 12, color: "#8A8069" }}>{s.type}</div>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: "#3F5A33" }}>
                {formatMoney(s.fee) || "₱0"}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        For Collection ({unpaidThisYear.length})
      </div>
      <div style={{ marginBottom: 22 }}>
        {unpaidThisYear.length === 0 ? (
          <div style={styles.empty}>Nothing pending collection this year.</div>
        ) : (
          unpaidThisYear.map((s, i) => (
            <div key={s.id} style={{ ...styles.row, ...(i === unpaidThisYear.length - 1 ? styles.rowLast : {}) }}>
              <div>
                <div style={{ fontSize: 14 }}>{clientName(s.clientId)}</div>
                <div style={{ fontSize: 12, color: "#8A8069" }}>{s.type}</div>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: brick }}>
                {formatMoney(s.fee) || "₱0"}
              </div>
            </div>
          ))
        )}
      </div>

      {otherYears.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Previous Years
          </div>
          {otherYears.map((year, i) => {
            const totals = collectionsByYear[year];
            return (
              <div key={year} style={{ ...styles.row, ...(i === otherYears.length - 1 ? styles.rowLast : {}) }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{year}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#8A8069" }}>
                  <span>Collected: {formatMoney(totals.collected) || "₱0"}</span>
                  <span>For collection: {formatMoney(totals.forCollection) || "₱0"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {collectionYears.length === 0 && (
        <div style={styles.empty}>No service fees logged yet — add one in the Services tab.</div>
      )}
    </div>
  );
}

function AssetsView({
  styles, data, financeScope, showAssetForm, setShowAssetForm, assetForm, setAssetForm,
  assetFormError, setAssetFormError, addAsset, editingAssetId, setEditingAssetId, startEditAsset, deleteAsset, brick,
}) {
  const scopedAssets = data.assets.filter((a) => (a.scope || "Personal") === financeScope);
  const total = scopedAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>{financeScope} Assets</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showAssetForm) {
              setEditingAssetId(null);
              setAssetForm({ name: "", category: ASSET_CATEGORIES[0], value: "", notes: "" });
              setAssetFormError("");
            }
            setShowAssetForm((s) => !s);
          }}
        >
          {showAssetForm ? "cancel" : "+ add asset"}
        </button>
      </div>

      <div style={{ ...styles.formCard, textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
          Total Assets
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#25313D" }}>{formatMoney(total) || "₱0"}</div>
      </div>

      {showAssetForm && (
        <div style={styles.formCard}>
          {assetFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {assetFormError}
            </div>
          )}
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={assetForm.name}
            onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
            placeholder="e.g. BDO Savings, BTC Wallet, Condo Unit"
          />
          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={assetForm.category}
            onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label style={styles.label}>Approximate value</label>
          <input
            style={styles.input}
            type="number"
            value={assetForm.value}
            onChange={(e) => setAssetForm({ ...assetForm, value: e.target.value })}
            placeholder="500000"
          />
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={assetForm.notes}
            onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
            placeholder="Optional"
          />
          <button style={styles.addBtn} onClick={addAsset}>
            {editingAssetId ? "update asset" : "save asset"}
          </button>
        </div>
      )}

      {ASSET_CATEGORIES.map((cat) => {
        const items = scopedAssets.filter((a) => a.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {cat} ({items.length})
            </div>
            {items.map((a, i) => (
              <div key={a.id} style={{ ...styles.row, ...(i === items.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{a.name}</div>
                  {a.notes && <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic" }}>{a.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: "#3F5A33" }}>
                    {formatMoney(a.value) || "₱0"}
                  </div>
                  <button style={styles.smallBtn} onClick={() => startEditAsset(a)}>edit</button>
                  <button style={{ ...styles.smallBtn, borderColor: brick, color: brick }} onClick={() => deleteAsset(a.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {scopedAssets.length === 0 && <div style={styles.empty}>No {financeScope.toLowerCase()} assets logged yet.</div>}
    </div>
  );
}

function LiabilitiesView({
  styles, data, financeScope, showLiabilityForm, setShowLiabilityForm, liabilityForm, setLiabilityForm,
  liabilityFormError, setLiabilityFormError, addLiability, editingLiabilityId, setEditingLiabilityId,
  startEditLiability, deleteLiability, brick,
}) {
  const scopedLiabilities = data.liabilities.filter((l) => (l.scope || "Personal") === financeScope);
  const total = scopedLiabilities.reduce((sum, l) => sum + (Number(l.balance) || 0), 0);

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>{financeScope} Liabilities</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showLiabilityForm) {
              setEditingLiabilityId(null);
              setLiabilityForm({ name: "", category: LIABILITY_CATEGORIES[0], balance: "", notes: "" });
              setLiabilityFormError("");
            }
            setShowLiabilityForm((s) => !s);
          }}
        >
          {showLiabilityForm ? "cancel" : "+ add liability"}
        </button>
      </div>

      <div style={{ ...styles.formCard, textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
          Total Liabilities
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#B5502D" }}>{formatMoney(total) || "₱0"}</div>
      </div>

      {showLiabilityForm && (
        <div style={styles.formCard}>
          {liabilityFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {liabilityFormError}
            </div>
          )}
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={liabilityForm.name}
            onChange={(e) => setLiabilityForm({ ...liabilityForm, name: e.target.value })}
            placeholder="e.g. Toyota Auto Loan, BPI Credit Card"
          />
          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={liabilityForm.category}
            onChange={(e) => setLiabilityForm({ ...liabilityForm, category: e.target.value })}
          >
            {LIABILITY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label style={styles.label}>Outstanding balance</label>
          <input
            style={styles.input}
            type="number"
            value={liabilityForm.balance}
            onChange={(e) => setLiabilityForm({ ...liabilityForm, balance: e.target.value })}
            placeholder="150000"
          />
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={liabilityForm.notes}
            onChange={(e) => setLiabilityForm({ ...liabilityForm, notes: e.target.value })}
            placeholder="Optional — e.g. monthly payment, term"
          />
          <button style={styles.addBtn} onClick={addLiability}>
            {editingLiabilityId ? "update liability" : "save liability"}
          </button>
        </div>
      )}

      {LIABILITY_CATEGORIES.map((cat) => {
        const items = scopedLiabilities.filter((l) => l.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {cat} ({items.length})
            </div>
            {items.map((l, i) => (
              <div key={l.id} style={{ ...styles.row, ...(i === items.length - 1 ? styles.rowLast : {}) }}>
                <div>
                  <div style={{ fontSize: 14 }}>{l.name}</div>
                  {l.notes && <div style={{ fontSize: 12, color: "#8A8069", fontStyle: "italic" }}>{l.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: "#B5502D" }}>
                    {formatMoney(l.balance) || "₱0"}
                  </div>
                  <button style={styles.smallBtn} onClick={() => startEditLiability(l)}>edit</button>
                  <button style={{ ...styles.smallBtn, borderColor: brick, color: brick }} onClick={() => deleteLiability(l.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {scopedLiabilities.length === 0 && <div style={styles.empty}>No {financeScope.toLowerCase()} liabilities logged yet.</div>}
    </div>
  );
}

function CashflowView({
  styles, data, financeScope, beginningBalance, setBeginningBalance,
  showCashflowForm, setShowCashflowForm, cashflowForm, setCashflowForm,
  cashflowFormError, setCashflowFormError, addCashflow, editingCashflowId, setEditingCashflowId,
  startEditCashflow, deleteCashflow, brick,
}) {
  const scopedCashflow = data.cashflow.filter((c) => (c.scope || "Personal") === financeScope);
  const sorted = [...scopedCashflow].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const actual = scopedCashflow.filter((c) => c.status === "Actual");
  const forecasted = scopedCashflow.filter((c) => c.status === "Forecasted");
  const actualIncome = actual.filter((c) => c.type === "Income").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const actualExpense = actual.filter((c) => c.type === "Expense").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const forecastIncome = forecasted.filter((c) => c.type === "Income").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const forecastExpense = forecasted.filter((c) => c.type === "Expense").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const beginBal = Number(beginningBalance) || 0;
  const currentBalance = beginBal + actualIncome - actualExpense;

  return (
    <div>
      <div style={styles.sectionHead}>
        <h2 style={styles.h2}>{financeScope} Cash Flow</h2>
        <button
          style={styles.addBtn}
          onClick={() => {
            if (showCashflowForm) {
              setEditingCashflowId(null);
              setCashflowForm({
                type: "Income",
                category: INCOME_CATEGORIES[0],
                description: "",
                amount: "",
                date: todayISO(),
                status: "Actual",
                notes: "",
              });
              setCashflowFormError("");
            }
            setShowCashflowForm((s) => !s);
          }}
        >
          {showCashflowForm ? "cancel" : "+ add entry"}
        </button>
      </div>

      <div style={{ ...styles.formCard, marginBottom: 16 }}>
        <label style={styles.label}>Beginning Balance ({financeScope})</label>
        <input
          style={styles.input}
          type="number"
          value={beginningBalance}
          onChange={(e) => setBeginningBalance(financeScope, e.target.value)}
          placeholder="Set once — the balance you're starting from"
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase" }}>
            Current Balance (Beginning + Actual Cash Flow)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: currentBalance >= 0 ? "#3F5A33" : "#B5502D" }}>
            {formatMoney(currentBalance) || "₱0"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ ...styles.formCard, flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", marginBottom: 6 }}>
            Actual Net
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: actualIncome - actualExpense >= 0 ? "#3F5A33" : "#B5502D" }}>
            {formatMoney(actualIncome - actualExpense) || "₱0"}
          </div>
        </div>
        <div style={{ ...styles.formCard, flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", marginBottom: 6 }}>
            Forecasted Net
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: forecastIncome - forecastExpense >= 0 ? "#3F5A33" : "#B5502D" }}>
            {formatMoney(forecastIncome - forecastExpense) || "₱0"}
          </div>
        </div>
      </div>

      {showCashflowForm && (
        <div style={styles.formCard}>
          {cashflowFormError && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
              {cashflowFormError}
            </div>
          )}
          <label style={styles.label}>Type</label>
          <select
            style={styles.input}
            value={cashflowForm.type}
            onChange={(e) => {
              const newType = e.target.value;
              const defaultCategory = newType === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
              setCashflowForm({ ...cashflowForm, type: newType, category: defaultCategory });
            }}
          >
            {CASHFLOW_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={cashflowForm.category}
            onChange={(e) => setCashflowForm({ ...cashflowForm, category: e.target.value })}
          >
            {(cashflowForm.type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label style={styles.label}>Description</label>
          <input
            style={styles.input}
            value={cashflowForm.description}
            onChange={(e) => setCashflowForm({ ...cashflowForm, description: e.target.value })}
            placeholder="e.g. October salary, Japan trip, BDO auto loan payment"
          />
          <label style={styles.label}>Amount</label>
          <input
            style={styles.input}
            type="number"
            value={cashflowForm.amount}
            onChange={(e) => setCashflowForm({ ...cashflowForm, amount: e.target.value })}
            placeholder="20000"
          />
          <label style={styles.label}>Date</label>
          <input
            style={styles.input}
            type="date"
            value={cashflowForm.date}
            onChange={(e) => setCashflowForm({ ...cashflowForm, date: e.target.value })}
          />
          <label style={styles.label}>Status</label>
          <select
            style={styles.input}
            value={cashflowForm.status}
            onChange={(e) => setCashflowForm({ ...cashflowForm, status: e.target.value })}
          >
            {CASHFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label style={styles.label}>Notes</label>
          <input
            style={styles.input}
            value={cashflowForm.notes}
            onChange={(e) => setCashflowForm({ ...cashflowForm, notes: e.target.value })}
            placeholder="Optional"
          />
          <button style={styles.addBtn} onClick={addCashflow}>
            {editingCashflowId ? "update entry" : "save entry"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={styles.empty}>No cash flow entries yet.</div>
      ) : (
        sorted.map((c, i) => (
          <div key={c.id} style={{ ...styles.row, ...(i === sorted.length - 1 ? styles.rowLast : {}) }}>
            <div>
              <div style={{ fontSize: 14 }}>{c.description}</div>
              <div style={{ fontSize: 12, color: "#8A8069" }}>
                {c.category} · {formatDate(c.date)} · {c.status}
                {c.notes ? " · " + c.notes : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: c.type === "Income" ? "#3F5A33" : "#B5502D" }}>
                {c.type === "Income" ? "+" : "−"}{formatMoney(c.amount) || "₱0"}
              </div>
              <button style={styles.smallBtn} onClick={() => startEditCashflow(c)}>edit</button>
              <button style={{ ...styles.smallBtn, borderColor: brick, color: brick }} onClick={() => deleteCashflow(c.id)}>×</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StatementsView({ styles, data, financeScope, brick }) {
  const scopedAssets = data.assets.filter((a) => (a.scope || "Personal") === financeScope);
  const scopedLiabilities = data.liabilities.filter((l) => (l.scope || "Personal") === financeScope);
  const scopedCashflow = data.cashflow.filter((c) => (c.scope || "Personal") === financeScope);
  const beginBal = Number(data.beginningBalances[financeScope]) || 0;

  const totalAssets = scopedAssets.reduce((s, a) => s + (Number(a.value) || 0), 0);
  const totalLiabilities = scopedLiabilities.reduce((s, l) => s + (Number(l.balance) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const assetsByCategory = ASSET_CATEGORIES.map((cat) => ({
    category: cat,
    total: scopedAssets.filter((a) => a.category === cat).reduce((s, a) => s + (Number(a.value) || 0), 0),
  })).filter((c) => c.total > 0);

  const liabilitiesByCategory = LIABILITY_CATEGORIES.map((cat) => ({
    category: cat,
    total: scopedLiabilities.filter((l) => l.category === cat).reduce((s, l) => s + (Number(l.balance) || 0), 0),
  })).filter((c) => c.total > 0);

  const actual = scopedCashflow.filter((c) => c.status === "Actual");
  const totalIncome = actual.filter((c) => c.type === "Income").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const totalExpense = actual.filter((c) => c.type === "Expense").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const netIncome = totalIncome - totalExpense;
  const currentCashBalance = beginBal + totalIncome - totalExpense;

  const incomeByCategory = INCOME_CATEGORIES.map((cat) => ({
    category: cat,
    total: actual.filter((c) => c.type === "Income" && c.category === cat).reduce((s, c) => s + (Number(c.amount) || 0), 0),
  })).filter((c) => c.total > 0);

  const expenseByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    total: actual.filter((c) => c.type === "Expense" && c.category === cat).reduce((s, c) => s + (Number(c.amount) || 0), 0),
  })).filter((c) => c.total > 0);

  const forecasted = [...scopedCashflow]
    .filter((c) => c.status === "Forecasted")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const forecastIncome = forecasted.filter((c) => c.type === "Income").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const forecastExpense = forecasted.filter((c) => c.type === "Expense").reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const row = (label, value, bold, color, indent) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", paddingLeft: indent ? 12 : 0, fontWeight: bold ? 700 : 400, fontSize: indent ? 13 : 14 }}>
      <div style={{ color: indent ? "#6B6252" : "inherit" }}>{label}</div>
      <div style={{ fontFamily: "'Courier New', monospace", color: color || "inherit" }}>{formatMoney(value) || "₱0"}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ ...styles.h2, marginBottom: 12 }}>{financeScope} Statements</h2>

      <div style={{ ...styles.formCard, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Balance Sheet
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Assets</div>
        {assetsByCategory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8A8069", padding: "4px 0 4px 12px" }}>None logged yet</div>
        ) : (
          assetsByCategory.map((c) => row(c.category, c.total, false, "#3F5A33", true))
        )}
        {row("Total Assets", totalAssets, true, "#3F5A33")}

        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 10 }}>Liabilities</div>
        {liabilitiesByCategory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8A8069", padding: "4px 0 4px 12px" }}>None logged yet</div>
        ) : (
          liabilitiesByCategory.map((c) => row(c.category, c.total, false, "#B5502D", true))
        )}
        {row("Total Liabilities", totalLiabilities, true, "#B5502D")}

        <div style={{ borderTop: "1px solid #D8D0BC", marginTop: 8, paddingTop: 8 }}>
          {row("Net Worth", netWorth, true, netWorth >= 0 ? "#3F5A33" : "#B5502D")}
        </div>
      </div>

      <div style={{ ...styles.formCard, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Income Statement (Actual)
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Income</div>
        {incomeByCategory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8A8069", padding: "4px 0 4px 12px" }}>None logged yet</div>
        ) : (
          incomeByCategory.map((c) => row(c.category, c.total, false, "#3F5A33", true))
        )}
        {row("Total Income", totalIncome, true, "#3F5A33")}

        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 10 }}>Expenses</div>
        {expenseByCategory.length === 0 ? (
          <div style={{ fontSize: 12, color: "#8A8069", padding: "4px 0 4px 12px" }}>None logged yet</div>
        ) : (
          expenseByCategory.map((c) => row(c.category, c.total, false, "#B5502D", true))
        )}
        {row("Total Expenses", totalExpense, true, "#B5502D")}

        <div style={{ borderTop: "1px solid #D8D0BC", marginTop: 8, paddingTop: 8 }}>
          {row("Net Income", netIncome, true, netIncome >= 0 ? "#3F5A33" : "#B5502D")}
        </div>
        <div style={{ borderTop: "1px solid #D8D0BC", marginTop: 8, paddingTop: 8 }}>
          {row("Beginning Balance", beginBal, false, "#8A8069")}
          {row("Current Cash Balance", currentCashBalance, true, currentCashBalance >= 0 ? "#3F5A33" : "#B5502D")}
        </div>
      </div>

      <div style={{ ...styles.formCard, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Cash Flow Forecast
        </div>
        {row("Forecasted Income", forecastIncome, false, "#3F5A33")}
        {row("Forecasted Expenses", forecastExpense, false, "#B5502D")}
        <div style={{ borderTop: "1px solid #D8D0BC", marginTop: 6, paddingTop: 6 }}>
          {row("Forecasted Net", forecastIncome - forecastExpense, true, forecastIncome - forecastExpense >= 0 ? "#3F5A33" : "#B5502D")}
        </div>
        {forecasted.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {forecasted.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8A8069", padding: "3px 0" }}>
                <span>{formatDate(c.date)} — {c.description} ({c.category})</span>
                <span style={{ color: c.type === "Income" ? "#3F5A33" : "#B5502D" }}>
                  {c.type === "Income" ? "+" : "−"}{formatMoney(c.amount) || "₱0"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#8A8069" }}>
        Statements are calculated live from your Assets, Liabilities, and Cash Flow entries — nothing to generate manually.
      </div>
    </div>
  );
}

const PIE_COLORS = ["#A9822F", "#7FA168", "#C8763E", "#6B8A9A", "#B5502D", "#8A7F68", "#5A7A9A", "#9A6B8A"];

function ReportsView({ styles, data, clientName, brick }) {
  const now = new Date();
  const currentMonthKey = todayISO().slice(0, 7); // YYYY-MM

  const mtdServices = data.services.filter((s) => s.dueDate && s.dueDate.slice(0, 7) === currentMonthKey);
  const mtdCollected = mtdServices.filter((s) => s.paymentStatus === "Paid").reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
  const mtdForCollection = mtdServices.filter((s) => s.paymentStatus !== "Paid").reduce((sum, s) => sum + (Number(s.fee) || 0), 0);

  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const clientTotals = {};
  data.services.forEach((s) => {
    if (s.paymentStatus !== "Paid") return;
    const name = clientName(s.clientId);
    clientTotals[name] = (clientTotals[name] || 0) + (Number(s.fee) || 0);
  });
  const clientTotalsList = Object.entries(clientTotals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const pieData = clientTotalsList.map((c) => ({ name: c.name, value: c.total }));

  const statCard = (label, amount, color) => (
    <div style={{ ...styles.formCard, flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{formatMoney(amount) || "₱0"}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ ...styles.h2, marginBottom: 4 }}>Reports</h2>
      <div style={{ fontSize: 12, color: "#8A8069", marginBottom: 14 }}>{monthLabel}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {statCard("Collected (MTD)", mtdCollected, "#3F5A33")}
        {statCard("For Collection (MTD)", mtdForCollection, "#7A3E1E")}
        {statCard("Total (MTD)", mtdCollected + mtdForCollection, "#25313D")}
      </div>

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#8A8069", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Client Profitability — All-Time Collected
      </div>

      {pieData.length === 0 ? (
        <div style={styles.empty}>No paid services yet — nothing to break down.</div>
      ) : (
        <>
          <div style={{ ...styles.formCard, height: 260, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.name}>
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value) || "₱0"} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {clientTotalsList.map((c, i) => (
            <div key={c.name} style={{ ...styles.row, ...(i === clientTotalsList.length - 1 ? styles.rowLast : {}) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div style={{ fontSize: 14 }}>{c.name}</div>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: "#3F5A33" }}>
                {formatMoney(c.total) || "₱0"}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const ink = "#25313D";
  const paper = "#F7F3EA";
  const brass = "#A9822F";
  const line = "#D8D0BC";
  const cardBg = "#FFFDF8";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created — check your email to confirm, then log in.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: paper,
        fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
        color: ink,
      }}
    >
      <div style={{ width: 340, maxWidth: "90vw" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>RV2 Advisory & Real Estate Corp.</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#6B6252", marginTop: 2 }}>
            client & finance ledger
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ background: cardBg, border: `1px solid ${line}`, padding: 20 }}
        >
          {error && (
            <div style={{ color: "#B5502D", fontSize: 12, marginBottom: 10, fontFamily: "'Courier New', monospace" }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ color: "#3F5A33", fontSize: 12, marginBottom: 10, fontFamily: "'Courier New', monospace" }}>
              {info}
            </div>
          )}
          <label style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px", border: `1px solid ${line}`, background: "#FDFBF5", marginBottom: 10, fontFamily: "inherit" }}
          />
          <label style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#8A8069", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px", border: `1px solid ${line}`, background: "#FDFBF5", marginBottom: 14, fontFamily: "inherit" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "9px", fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.04em", background: ink, color: paper, border: "none", cursor: "pointer" }}
          >
            {loading ? "please wait…" : mode === "login" ? "log in" : "sign up"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}>
          {mode === "login" ? (
            <span>
              No account?{" "}
              <button onClick={() => { setMode("signup"); setError(""); setInfo(""); }} style={{ background: "none", border: "none", color: brass, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} style={{ background: "none", border: "none", color: brass, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>
                Log in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#8A8069" }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px", background: "#EFE9D9", fontFamily: "'Courier New', monospace", fontSize: 11 }}>
        <span style={{ color: "#6B6252", marginRight: 10 }}>{session.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ background: "none", border: "none", color: "#8A8069", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}
        >
          log out
        </button>
      </div>
      <CRM userId={session.user.id} />
    </div>
  );
}
