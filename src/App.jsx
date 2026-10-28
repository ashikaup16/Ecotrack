import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Check,
  CircleCheck,
  ChevronDown,
  CircleHelp,
  Cloud,
  Flame,
  Leaf,
  Lightbulb,
  LoaderCircle,
  LogOut,
  LockKeyhole,
  Mail,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const initialInputs = {
  commuteKmPerWeek: "120",
  flightHoursPerYear: "12",
  electricityKwhPerMonth: "280",
  householdSize: "2",
  clothingItemsPerMonth: "2",
  diet: "balanced",
};

const categoryColors = {
  Travel: "#64a77b",
  "Home energy": "#e8b45d",
  Food: "#8d9bce",
  Shopping: "#e58d73",
};

const categoryIcons = {
  Travel: CarFront,
  "Home energy": Zap,
  Food: Utensils,
  Shopping: ShoppingBag,
};

const ecoActions = [
  { id: "swap-short-trip", title: "Swap one short car trip", detail: "Walk, cycle, or share a ride this week.", icon: CarFront, color: "travel" },
  { id: "plant-forward-meal", title: "Choose a plant-forward meal", detail: "Try a new veggie favourite or meat-free lunch.", icon: Utensils, color: "food" },
  { id: "switch-off-standby", title: "Switch off standby power", detail: "Unplug one device you are not using.", icon: Zap, color: "energy" },
  { id: "avoid-food-waste", title: "Use up what is in the fridge", detail: "Plan one meal around ingredients you already have.", icon: Leaf, color: "nature" },
  { id: "repair-or-reuse", title: "Repair, borrow, or buy pre-loved", detail: "Give something a second life before buying new.", icon: ShoppingBag, color: "shopping" },
];

const goalOptions = [5, 10, 15, 20, 25];
const formatTons = (kg) => `${(kg / 1000).toFixed(1)} t`;
const formatMonth = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" });

function calculateStreak(history) {
  if (!history.length) return 0;
  let streak = 1;
  for (let index = history.length - 1; index > 0; index -= 1) {
    const current = new Date(`${history[index].month}-01T12:00:00`);
    const previous = new Date(`${history[index - 1].month}-01T12:00:00`);
    current.setMonth(current.getMonth() - 1);
    if (current.getFullYear() !== previous.getFullYear() || current.getMonth() !== previous.getMonth()) break;
    streak += 1;
  }
  return streak;
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { credentials: "same-origin", ...options });
  } catch {
    throw new Error("Can't reach the EcoTrack API. Start the app with `npm run dev`, then refresh.");
  }

  let data = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      throw new Error("EcoTrack returned an unreadable response. Restart the app and try again.");
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function buildRecommendations(result) {
  if (!result) return [];
  const sorted = Object.entries(result.categories)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const tips = {
    Travel: {
      title: "Make the next trip a little lighter",
      description: "Try swapping one short drive each week for a walk, bike ride, or shared trip.",
      impact: "Start with one trip",
      icon: CarFront,
    },
    "Home energy": {
      title: "Give your home energy a tune-up",
      description: "Lowering your thermostat by 1°C and switching off idle devices adds up over a year.",
      impact: "Try a one-degree shift",
      icon: Zap,
    },
    Food: {
      title: "Put more plants on your plate",
      description: "Try a few plant-forward meals each week and plan portions to avoid food waste.",
      impact: "Pick one plant-forward day",
      icon: Utensils,
    },
    Shopping: {
      title: "Give clothes a longer life",
      description: "Repair, swap, or buy pre-loved for your next wardrobe refresh.",
      impact: "Make your next buy second-hand",
      icon: ShoppingBag,
    },
  };
  return sorted.slice(0, 3).map(([category]) => tips[category]);
}

function Field({ label, unit, value, onChange, min = "0", max, step = "1" }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          required
        />
        <span className="input-unit">{unit}</span>
      </span>
    </label>
  );
}

function AuthScreen({ onAuthenticated, apiOffline, setApiOffline }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      setApiOffline(false);
      onAuthenticated(data);
    } catch (requestError) {
      setApiOffline(!requestError.status);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-art">
        <a className="brand auth-brand" href="#" aria-label="EcoTrack home">
          <span className="brand-mark"><Leaf size={21} strokeWidth={2.2} /></span>
          <span>eco<span>track</span></span>
        </a>
        <div className="auth-art-content">
          <span className="auth-eyebrow"><span /> YOUR EVERYDAY, A LITTLE LIGHTER</span>
          <h1>Small steps.<br /><span>Real change.</span></h1>
          <p>Get to know your footprint, keep your progress, and find the next good thing you can do.</p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-sun" />
            <div className="auth-cloud cloud-one" />
            <div className="auth-cloud cloud-two" />
            <div className="auth-hill auth-hill-back" />
            <div className="auth-hill auth-hill-front" />
            <div className="auth-plant"><span /><i /><b /></div>
            <span className="auth-star star-one">✳</span><span className="auth-star star-two">✳</span>
          </div>
        </div>
        <div className="auth-art-footer"><Leaf size={15} /> A more thoughtful way to track your impact.</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <span className="brand-mark"><Leaf size={20} /></span>
            <span>eco<span>track</span></span>
          </div>
          <div className="auth-kicker"><span className="auth-kicker-dot" /> YOUR PERSONAL CLIMATE SPACE</div>
          <h2>{mode === "signup" ? "Your greener days start here." : "Welcome back."}</h2>
          <p className="auth-subtitle">
            {mode === "signup"
              ? "Create your account to save your footprint and see your progress whenever you return."
              : "Sign in to pick up right where you left off."}
          </p>

          <div className="auth-switch" role="tablist" aria-label="Account action">
            <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button>
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Your name</span>
                <span className="auth-input"><Leaf size={17} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" minLength="2" maxLength="60" required /></span>
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <span className="auth-input"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength="254" required /></span>
            </label>
            <label className="auth-field">
              <span>Password <span className="password-hint">{mode === "signup" ? "10+ characters" : ""}</span></span>
              <span className="auth-input"><LockKeyhole size={17} /><input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "Create a password" : "Enter your password"} minLength={mode === "signup" ? "10" : undefined} maxLength="128" required /></span>
            </label>
            {error && <div className="form-error auth-error" role="alert">{error}</div>}
            {apiOffline && (
              <div className="api-offline" role="status">
                <span className="offline-indicator" />
                <span><strong>EcoTrack is not connected yet.</strong> In the project folder run <code>npm run dev</code>, then refresh.</span>
              </div>
            )}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? <><LoaderCircle className="spin" size={18} /> One moment...</> : <>{mode === "signup" ? "Create my EcoTrack account" : "Sign in to my account"}<ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="auth-privacy"><LockKeyhole size={14} /><span>Your profile and footprint stay on this EcoTrack installation. Passwords are securely hashed.</span></div>
          <div className="auth-value-row"><span><Check size={14} /> Private account</span><span><Check size={14} /> Progress saved</span><span><Check size={14} /> No pressure</span></div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [inputs, setInputs] = useState(initialInputs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [travelReduction, setTravelReduction] = useState(20);
  const [plantDays, setPlantDays] = useState(2);
  const [checkins, setCheckins] = useState([]);
  const [goalPercent, setGoalPercent] = useState(10);
  const [completedActions, setCompletedActions] = useState([]);
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyError, setJourneyError] = useState("");
  const recommendations = useMemo(() => buildRecommendations(result), [result]);
  const guideDifference = result ? 2.5 - result.totalKg / 1000 : 0;
  const monthlySeries = checkins.slice(-12).map((checkin) => ({
    ...checkin,
    monthLabel: formatMonth(checkin.month),
  }));
  const firstCheckin = checkins[0];
  const latestCheckin = checkins[checkins.length - 1];
  const goalReductionKg = firstCheckin ? Math.round(firstCheckin.totalKg * goalPercent / 100) : 0;
  const achievedReductionKg = firstCheckin && latestCheckin
    ? Math.max(0, firstCheckin.totalKg - latestCheckin.totalKg)
    : 0;
  const goalProgress = goalReductionKg
    ? Math.min(100, Math.round(achievedReductionKg / goalReductionKg * 100))
    : 0;
  const checkinStreak = calculateStreak(checkins);
  const sourceData = result
    ? Object.entries(result.categories)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }))
    : [];
  const travelSaving = result
    ? Number(inputs.commuteKmPerWeek) * 52 * result.factors.carKgPerKm * travelReduction / 100
    : 0;
  const dietDifference = result
    ? Math.max(0, result.factors.dietKgPerDay - result.factors.plantForwardDietKgPerDay)
    : 0;
  const foodSaving = Math.min(result?.categories.Food || 0, dietDifference * plantDays * 52);
  const projectedSaving = Math.round(travelSaving + foodSaving);
  const projectedFootprint = result ? Math.max(0, result.totalKg - projectedSaving) : 0;
  const projectedReduction = result?.totalKg ? Math.round(projectedSaving / result.totalKg * 100) : 0;

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        await apiRequest("/api/health");
        const data = await apiRequest("/api/auth/me");
        if (!active) return;
        applyAccount(data);
      } catch (requestError) {
        if (!active) return;
        if (requestError.status !== 401) {
          setApiOffline(true);
          setError(requestError.message);
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    }
    restoreSession();
    return () => { active = false; };
  }, []);

  function applyAccount(data) {
    setUser(data.user);
    setApiOffline(false);
    setError("");
    setUpdated(false);
    if (data.profile) {
      setInputs(Object.fromEntries(
        Object.entries(data.profile.inputs).map(([key, value]) => [key, String(value)]),
      ));
      setResult(data.profile.result);
    } else {
      setInputs(initialInputs);
      setResult(null);
    }
    setCheckins(data.journey?.history || []);
    setGoalPercent(data.journey?.goalPercent || 10);
    setCompletedActions(data.journey?.completedActions || []);
    setJourneyError("");
    setJourneySaving(false);
  }

  function updateField(key, value) {
    setInputs((current) => ({ ...current, [key]: value }));
    setUpdated(false);
  }

  async function calculate(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const payload = {
      ...inputs,
      commuteKmPerWeek: Number(inputs.commuteKmPerWeek),
      flightHoursPerYear: Number(inputs.flightHoursPerYear),
      electricityKwhPerMonth: Number(inputs.electricityKwhPerMonth),
      householdSize: Number(inputs.householdSize),
      clothingItemsPerMonth: Number(inputs.clothingItemsPerMonth),
    };

    try {
      const data = await apiRequest("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(data.result);
      setCheckins(data.history);
      setUpdated(true);
      setApiOffline(false);
    } catch (requestError) {
      setApiOffline(!requestError.status);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveJourney(nextGoal, nextActions) {
    setJourneySaving(true);
    setJourneyError("");
    try {
      const data = await apiRequest("/api/journey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalPercent: nextGoal,
          completedActions: nextActions,
        }),
      });
      setGoalPercent(data.goalPercent);
      setCompletedActions(data.completedActions);
      setApiOffline(false);
    } catch (requestError) {
      setJourneyError(requestError.message);
    } finally {
      setJourneySaving(false);
    }
  }

  function chooseGoal(nextGoal) {
    saveJourney(nextGoal, completedActions);
  }

  function toggleEcoAction(actionId) {
    const nextActions = completedActions.includes(actionId)
      ? completedActions.filter((id) => id !== actionId)
      : [...completedActions, actionId];
    saveJourney(goalPercent, nextActions);
  }

  async function signOut() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setUser(null);
      setInputs(initialInputs);
      setResult(null);
      setCheckins([]);
      setCompletedActions([]);
      setGoalPercent(10);
      setError("");
      setUpdated(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (authChecking) {
    return <main className="auth-loading"><span className="brand-mark"><Leaf size={22} /></span><span>Getting your EcoTrack ready...</span></main>;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={applyAccount} apiOffline={apiOffline} setApiOffline={setApiOffline} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="EcoTrack home">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
          <span>eco<span>track</span></span>
        </a>
        <div className="side-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span className="nav-dot" />Overview</a>
          <a className="nav-item" href="#calculator"><span className="nav-dot" />Footprint check</a>
          <a className="nav-item" href="#journey"><span className="nav-dot" />My journey</a>
          <a className="nav-item" href="#eco-actions"><span className="nav-dot" />Eco actions</a>
          <a className="nav-item" href="#impact-lab"><span className="nav-dot" />Impact lab</a>
          <a className="nav-item" href="#ideas"><span className="nav-dot" />Small steps</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-leaf-art" aria-hidden="true">
            <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
            <Leaf size={34} />
          </div>
          <p>Small changes.<br /><strong>A lighter tomorrow.</strong></p>
          <span className="side-caption">Your journey, at your pace.</span>
        </div>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div>
          <button type="button" className="signout-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <main id="overview" className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">My space <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="today-label">YOUR PERSONAL DASHBOARD</span>
            <span className="date-chip"><span className="live-dot" /> Saved to your account</span>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Dashboard sections">
          <a href="#overview">Overview</a><a href="#calculator">My footprint</a><a href="#journey">My journey</a><a href="#eco-actions">Eco actions</a><a href="#impact-lab">Impact lab</a>
        </nav>

        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span /> A LITTLE MORE AWARE, EVERY DAY</div>
            <h1>Hi {user.name.split(/\s+/)[0]},<br /><span>let's grow lighter.</span></h1>
            <p className="welcome-copy">Your everyday impact, made clearer. Your progress is saved here for next time.</p>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-hill hill-back" />
            <div className="art-hill hill-front" />
            <div className="art-stem"><span /><i /><b /></div>
            <div className="art-ground" />
          </div>
        </section>

        <section className="stats-grid" aria-label="Footprint summary">
          <article className="stat-card primary-stat">
            <div className="stat-heading"><span>YOUR YEARLY FOOTPRINT</span><span className="stat-icon"><Cloud size={19} /></span></div>
            <div className="stat-value">{result ? formatTons(result.totalKg) : "—"}</div>
            <div className="stat-foot"><span>tonnes CO₂e / year</span>{result && <span className="stat-badge"><Check size={14} /> Your estimate</span>}</div>
            <div className="stat-swoosh" />
          </article>
          <article className="stat-card">
            <div className="stat-heading"><span>MONTHLY AVERAGE</span><span className="stat-icon amber"><RotateCcw size={18} /></span></div>
            <div className="stat-value">{result ? `${(result.monthlyKg / 1000).toFixed(2)} t` : "—"}</div>
            <div className="stat-foot"><span>tonnes CO₂e / month</span><span className="soft-note">based on your habits</span></div>
          </article>
          <article className="stat-card target-stat">
            <div className="stat-heading"><span>THE BIG PICTURE</span><span className="stat-icon lavender"><Sparkles size={18} /></span></div>
            <div className="stat-value">{result ? `${Math.abs(guideDifference).toFixed(1)} t` : "—"}</div>
            <div className="stat-foot"><span>{guideDifference === 0 ? "at" : guideDifference < 0 ? "above" : "below"} 2.5 t guide</span><span className="help-note" title="An illustrative per-person annual guide, not a personal target."><CircleHelp size={17} /></span></div>
          </article>
        </section>

        <section className="analysis-grid">
          <article className="panel trend-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">WHAT SHAPES YOUR TOTAL</span><h2>Where your footprint adds up</h2></div>
              <span className="chart-period"><span className="chart-period-dot" /> kg CO₂e / year</span>
            </div>
            {result ? (
              <>
                <div className="chart-legend"><span><i /> Estimated yearly emissions</span><span>by source</span></div>
                <div className="area-chart source-bar-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData} layout="vertical" margin={{ top: 8, right: 20, bottom: 2, left: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#edf0e9" strokeDasharray="4 6" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#829080", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#657365", fontSize: 12 }} width={93} />
                      <Tooltip formatter={(value) => [`${value.toLocaleString()} kg CO₂e / year`, "Estimated"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8ece4", fontSize: 13 }} />
                      <Bar dataKey="value" barSize={24} radius={[0, 7, 7, 0]}>
                        {sourceData.map((item) => <Cell key={item.name} fill={categoryColors[item.name]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-note">Your estimates, split into the everyday sources that make them up.</p>
              </>
            ) : (
              <div className="empty-chart"><div className="empty-chart-icon"><Cloud size={25} /></div><strong>Your sources are waiting</strong><span>Save your estimate below to see which everyday habits add up.</span></div>
            )}
          </article>

          <article className="panel sources-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">WHERE IT COMES FROM</span><h2>Your main sources</h2></div>
              <span className="round-leaf"><Leaf size={18} /></span>
            </div>
            {result ? (
              <>
                <div className="donut-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={66} outerRadius={88} paddingAngle={4} stroke="none" cornerRadius={5}>
                        {sourceData.map((item) => <Cell key={item.name} fill={categoryColors[item.name]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value.toLocaleString()} kg CO₂e`, "Estimated yearly"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8ece4", fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center"><strong>{formatTons(result.totalKg)}</strong><span>THIS YEAR</span></div>
                </div>
                <div className="source-list">
                  {Object.entries(result.categories).map(([category, value]) => {
                    const Icon = categoryIcons[category];
                    return <div className="source-row" key={category}><span className="source-name"><i style={{ backgroundColor: categoryColors[category] }} /><Icon size={17} />{category}</span><strong>{formatTons(value)}</strong></div>;
                  })}
                </div>
              </>
            ) : (
              <div className="empty-sources"><div className="source-placeholder"><span /><span /><span /><span /></div><strong>See what shapes your footprint</strong><span>We’ll break your estimate into everyday sources.</span></div>
            )}
          </article>
        </section>

        <section id="journey" className="journey-section">
          <div className="section-title-row">
            <div><span className="section-kicker">YOUR OWN REAL-WORLD PROGRESS</span><h2>Every check-in tells a story</h2><p>Your chart updates when you save a monthly estimate. Nothing is filled in or guessed.</p></div>
            <span className="journey-streak"><Flame size={17} /> {checkinStreak} month{checkinStreak === 1 ? "" : "s"} in a row</span>
          </div>
          <div className="journey-grid">
            <article className="panel journey-chart-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">MONTHLY CHECK-INS</span><h2>Your footprint over time</h2></div>
                <span className="checkin-count"><CalendarDays size={16} /> {Math.min(checkins.length, 12)} / 12 months</span>
              </div>
              {checkins.length ? (
                <>
                  <div className="chart-legend"><span><i /> Your saved estimate</span><span>kg CO₂e / year</span></div>
                  <div className="journey-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlySeries} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
                        <defs><linearGradient id="journeyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8290c5" stopOpacity={0.28} /><stop offset="95%" stopColor="#8290c5" stopOpacity={0.02} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="#edf0e9" strokeDasharray="4 6" />
                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: "#829080", fontSize: 12 }} dy={12} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#829080", fontSize: 11 }} />
                        <Tooltip labelFormatter={(_label, items) => items[0]?.payload.month} formatter={(value) => [`${value.toLocaleString()} kg CO₂e / year`, "Check-in"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8ece4", fontSize: 13 }} />
                        <Area type="monotone" dataKey="totalKg" stroke="#7886b5" strokeWidth={3} fill="url(#journeyFill)" dot={{ r: 5, fill: "#7886b5", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, fill: "#7886b5", stroke: "#fff", strokeWidth: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="history-months" aria-label="Recorded monthly check-ins">
                    {checkins.slice(-6).map((checkin) => (
                      <span key={checkin.month}><i />{formatMonth(checkin.month)} <strong>{formatTons(checkin.totalKg)}</strong></span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="journey-chart-empty"><span><CalendarDays size={24} /></span><strong>Your first monthly check-in is one step away</strong><p>Save an estimate below to start your personal footprint timeline.</p><a href="#calculator">Make my first check-in <ArrowRight size={15} /></a></div>
              )}
            </article>

            <article className="panel goal-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">A GOAL THAT FEELS LIKE YOURS</span><h2>Choose your next goal</h2></div>
                <span className="goal-icon"><Target size={19} /></span>
              </div>
              <p className="goal-description">Pick a gentle reduction goal from your first recorded check-in. You can change it whenever you like.</p>
              <div className="goal-options" role="group" aria-label="Choose annual footprint reduction goal">
                {goalOptions.map((option) => (
                  <button
                    className={goalPercent === option ? "selected" : ""}
                    disabled={journeySaving}
                    key={option}
                    onClick={() => chooseGoal(option)}
                    type="button"
                    aria-pressed={goalPercent === option}
                  >{option}%</button>
                ))}
              </div>
              <div className="goal-progress-copy">
                <span>{firstCheckin ? "Progress toward your goal" : "Your progress will start at your first check-in"}</span>
                {firstCheckin && <strong>{goalProgress}%</strong>}
              </div>
              <div className="goal-progress-track"><span style={{ width: `${goalProgress}%` }} /></div>
              <div className="goal-metrics">
                <div><span>Goal</span><strong>{firstCheckin ? `${goalReductionKg.toLocaleString()} kg` : `${goalPercent}%`}</strong></div>
                <div><span>Reduced so far</span><strong>{firstCheckin ? `${achievedReductionKg.toLocaleString()} kg` : "—"}</strong></div>
              </div>
              <div className="goal-note"><Trophy size={16} /><span>{firstCheckin ? `${formatTons(firstCheckin.totalKg)} baseline · first saved check-in` : "Your first estimate becomes your personal baseline."}</span></div>
              {journeySaving && <span className="save-status" role="status">Saving your journey...</span>}
              {journeyError && <p className="journey-error" role="alert">{journeyError}</p>}
            </article>
          </div>
        </section>

        <section id="eco-actions" className="eco-actions-section">
          <div className="section-title-row">
            <div><span className="section-kicker">SMALL THINGS, DONE YOUR WAY</span><h2>Your eco-action board</h2><p>Pick practical steps to try. Your personal checklist stays saved with your account.</p></div>
            <span className="action-score"><CircleCheck size={17} /><strong>{completedActions.length}</strong> / {ecoActions.length} tried</span>
          </div>
          <div className="action-progress" aria-label={`${completedActions.length} of ${ecoActions.length} actions completed`}><span style={{ width: `${completedActions.length / ecoActions.length * 100}%` }} /></div>
          <div className="action-grid">
            {ecoActions.map((action) => {
              const Icon = action.icon;
              const isComplete = completedActions.includes(action.id);
              return (
                <button
                  type="button"
                  className={`action-card ${isComplete ? "complete" : ""}`}
                  key={action.id}
                  onClick={() => toggleEcoAction(action.id)}
                  disabled={journeySaving}
                  aria-pressed={isComplete}
                >
                  <span className={`action-icon ${action.color}`}><Icon size={20} /></span>
                  <span className="action-copy"><strong>{action.title}</strong><small>{action.detail}</small></span>
                  <span className="action-check">{isComplete && <Check size={15} />}</span>
                </button>
              );
            })}
          </div>
          {journeyError && <p className="journey-error action-error" role="alert">{journeyError}</p>}
        </section>

        <section id="impact-lab" className="impact-lab-section">
          <div className="section-title-row">
            <div><span className="section-kicker">A LITTLE EXPERIMENT</span><h2>Your what-if impact lab</h2><p>Play with two small changes and see how your yearly estimate could shift.</p></div>
            <span className="impact-lab-badge"><Sparkles size={15} /> JUST FOR YOU</span>
          </div>
          {result ? (
            <div className="impact-lab">
              <div className="impact-controls">
                <label className="impact-slider-control">
                  <span className="slider-title"><span className="impact-control-icon travel"><CarFront size={19} /></span><span><strong>Drive a little less</strong><small>Reduce your car travel</small></span><b>{travelReduction}%</b></span>
                  <input aria-label="Reduce car travel percentage" type="range" min="0" max="50" step="5" value={travelReduction} onChange={(event) => setTravelReduction(Number(event.target.value))} style={{ "--range-progress": `${travelReduction * 2}%` }} />
                  <span className="range-hints"><span>Keep it as is</span><span>Half your trips</span></span>
                </label>
                <label className="impact-slider-control">
                  <span className="slider-title"><span className="impact-control-icon food"><Utensils size={18} /></span><span><strong>Try more plant-forward days</strong><small>Swap a meat-heavy day each week</small></span><b>{plantDays} <small>/ 7</small></b></span>
                  <input aria-label="Plant-forward days per week" type="range" min="0" max="7" step="1" value={plantDays} onChange={(event) => setPlantDays(Number(event.target.value))} style={{ "--range-progress": `${plantDays / 7 * 100}%` }} />
                  <span className="range-hints"><span>None yet</span><span>Every day</span></span>
                </label>
                <p className="impact-disclaimer"><CircleHelp size={15} /> A playful estimate using the same broad factors — not a promise or formal measurement.</p>
              </div>
              <div className="impact-result">
                <div className="impact-result-label"><Sparkles size={16} /> YOUR POSSIBLE NEXT CHAPTER</div>
                <div className="impact-numbers"><div><span>Current estimate</span><strong>{formatTons(result.totalKg)}</strong></div><ArrowRight size={20} /><div><span>With these changes</span><strong>{formatTons(projectedFootprint)}</strong></div></div>
                <div className="impact-meter"><span style={{ width: `${Math.min(100, projectedReduction)}%` }} /></div>
                <div className="impact-result-foot"><strong><ArrowDownRight size={16} /> {projectedSaving.toLocaleString()} kg less / year</strong><span>{projectedReduction}% potential reduction</span></div>
                <div className="impact-decoration" aria-hidden="true"><Leaf size={62} /><span /><i /></div>
              </div>
            </div>
          ) : (
            <div className="impact-empty"><span className="impact-empty-icon"><Sparkles size={20} /></span><div><strong>Your own little climate experiment</strong><p>Calculate your footprint first, then explore how small changes might add up.</p></div><a href="#calculator">Start with your habits <ArrowRight size={16} /></a></div>
          )}
        </section>

        <section id="calculator" className="calculator-section">
          <div className="section-title-row">
            <div><span className="section-kicker">YOUR EVERYDAY, YOUR ESTIMATE</span><h2>What does a typical week look like?</h2><p>A few quick details help us create a more personal estimate.</p></div>
            <span className="step-count"><span>01</span> / 01</span>
          </div>
          <form className="input-panel" onSubmit={calculate}>
            <div className="input-group">
              <div className="group-heading"><span className="group-icon transport"><CarFront size={19} /></span><div><h3>Getting around</h3><span>Trips that get you places</span></div></div>
              <div className="fields-row">
                <Field label="Car travel, per week" unit="km" max="3000" value={inputs.commuteKmPerWeek} onChange={(event) => updateField("commuteKmPerWeek", event.target.value)} />
                <Field label="Flights, per year" unit="hrs" max="1000" value={inputs.flightHoursPerYear} onChange={(event) => updateField("flightHoursPerYear", event.target.value)} />
              </div>
            </div>
            <div className="input-divider" />
            <div className="input-group">
              <div className="group-heading"><span className="group-icon home"><Zap size={19} /></span><div><h3>At home</h3><span>Your shared home energy</span></div></div>
              <div className="fields-row">
                <Field label="Electricity, per month" unit="kWh" max="10000" value={inputs.electricityKwhPerMonth} onChange={(event) => updateField("electricityKwhPerMonth", event.target.value)} />
                <Field label="People in your home" unit="people" min="1" max="30" value={inputs.householdSize} onChange={(event) => updateField("householdSize", event.target.value)} />
              </div>
            </div>
            <div className="input-divider" />
            <div className="input-group">
              <div className="group-heading"><span className="group-icon lifestyle"><Leaf size={19} /></span><div><h3>Your lifestyle</h3><span>Small choices, counted together</span></div></div>
              <div className="fields-row lifestyle-fields">
                <label className="field"><span className="field-label">Your usual eating style</span><span className="select-wrap"><select value={inputs.diet} onChange={(event) => updateField("diet", event.target.value)}><option value="plant-forward">Mostly plant-forward</option><option value="balanced">A bit of everything</option><option value="meat-heavy">Meat with most meals</option></select><ChevronDown size={17} /></span></label>
                <Field label="New clothing, per month" unit="items" max="100" value={inputs.clothingItemsPerMonth} onChange={(event) => updateField("clothingItemsPerMonth", event.target.value)} />
              </div>
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="form-footer">
              <span><CalendarDays size={16} /> Saving this estimate records your {formatMonth(new Date().toISOString().slice(0, 7))} monthly check-in. Recalculating updates this month.</span>
              <button className="calculate-button" type="submit" disabled={loading}>
                {loading ? <><LoaderCircle className="spin" size={17} /> Calculating...</> : result ? "Save this month's check-in" : "Calculate & save my check-in"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </div>
            <p className="estimation-note"><CircleHelp size={15} /> Estimates use broad averages — a helpful starting point, not a precise measurement.</p>
          </form>
        </section>

        <section id="ideas" className="ideas-section">
          <div className="section-title-row ideas-title">
            <div><span className="section-kicker">GOOD THINGS START SMALL</span><h2>A few ideas for your next step</h2></div>
            <a href="#impact-lab" className="text-link">Explore your impact <ArrowRight size={16} /></a>
          </div>
          {recommendations.length ? (
            <div className="ideas-grid">
              {recommendations.map((idea, index) => {
                const Icon = idea.icon;
                return <article className="idea-card" key={idea.title}><div className={`idea-icon idea-${index}`}><Icon size={20} /></div><span className="idea-impact"><ArrowDownRight size={15} />{idea.impact}</span><h3>{idea.title}</h3><p>{idea.description}</p><a href="#impact-lab">Try it in your impact lab <ArrowRight size={15} /></a></article>;
              })}
            </div>
          ) : (
            <div className="ideas-empty"><div className="idea-sparkle"><Lightbulb size={21} /></div><div><strong>Your ideas are just around the corner</strong><p>Calculate your footprint to get practical, personal starting points.</p></div><ArrowUpRight size={18} /></div>
          )}
        </section>

        <footer className="footer"><span><span className="footer-mark"><Leaf size={16} /></span> Thoughtfully tracking, one step at a time.</span><span>Estimates are for learning and awareness, not formal reporting.</span></footer>
        {updated && <div className="update-toast" role="status"><span><Check size={15} /></span> Your estimate and monthly check-in are saved</div>}
      </main>
    </div>
  );
}

export default App;
