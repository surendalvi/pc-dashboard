/* SABIC Saudi Kayan Polycarbonate Digital Twin Dashboard Controller */

// Global state for simulating DCS / Historian Tags
const TAG_DEFAULTS = {
    // Monomer Section Tags
    '100_FT_001_EO_FEED': 22000,       // kg/h
    '100_FT_002_CO2_FEED': 24500,      // kg/h
    '100_FT_003_CO2_VENT': 150,        // kg/h
    '100_PT_012_RXT_SHELL': 2.8,       // MPa
    '200_FT_010_EC_FEED': 44.2,        // t/h
    '200_FT_011_MEOH_RECY': 32.5,      // t/h
    '200_FT_020_DMC_OUT': 45.0,        // t/h
    '200_FT_030_MEG_OUT': 31.0,        // t/h
    '200_FT_ST_HP_C210': 14.8,         // t/h
    '200_FT_ST_LP_C220': 8.9,          // t/h
    '300_FT_001_PHENOL_IN': 68.4,       // t/h
    '300_FT_040_DPC_OUT': 31.2,        // t/h
    '300_FT_ST_MP_C310': 15.4,         // t/h
    '300_FT_ST_MP_C320': 10.2,         // t/h
    '300_TT_C310_REB_IN': 202.4,       // °C
    '300_TT_C310_REB_OUT': 208.5,      // °C
    '300_TT_C310_ST_IN': 245.0,        // °C
    '300_TT_C310_ST_OUT': 240.0,       // °C
    '300_PT_C320_VAC': 22.5,           // kPa

    // Polymer Section Tags
    '400_FT_001_BPA_MELT': 28.5,       // t/h
    '400_FT_002_DPC_MELT': 31.2,       // t/h
    '400_JI_R410_AGIT': 45.0,          // kW
    '500_FT_090_PC_EXT': 31.2,         // t/h
    '500_FT_ST_EJ_MOTIVE': 1800,       // kg/h
    '500_PT_R510_DEEPVAC': 0.65,       // mbar
    '500_PDT_F520_FILTER': 1.25,       // MPa
    '500_EI_P510_TORQ': 1250,          // N·m
        '500_SE_P510_RPM': 42.0,           // RPM
    '500_JI_P510_GEAR': 110.0,         // kW (discharge pump power)
    'LAB_AI_PC_YI': 1.18,              // YI
    'LAB_AI_PC_MFI': 14.2              // g/10 min
};

// Target Golden Run Profiles (Optimums)
const GOLDEN_RUN = {
    '100_FT_001_EO_FEED': 22500,
    '100_FT_002_CO2_FEED': 25000,
    '200_FT_020_DMC_OUT': 46.5,
    '200_FT_ST_HP_C210': 12.5,
    '200_FT_ST_LP_C220': 8.2,
    '300_FT_040_DPC_OUT': 32.5,
    '300_FT_ST_MP_C310': 13.8,
    '300_PT_C320_VAC': 20.0,
    '400_FT_001_BPA_MELT': 29.8,
    '500_FT_090_PC_EXT': 32.5,
    '500_PT_R510_DEEPVAC': 0.18,
    '500_EI_P510_TORQ': 1120,
    '500_SE_P510_RPM': 38.0,
    '500_JI_P510_GEAR': 95.0,
    'LAB_AI_PC_YI': 0.95,
    'LAB_AI_PC_MFI': 15.0
};

// Economics Configuration (SABIC Saudi Kayan Base Tariffs)
const ECONOMICS = {
    pc_price: 2400,        // $/ton
    meg_price: 520,        // $/ton
    eo_price: 1100,        // $/ton
    co2_price: 45,         // $/ton
    bpa_price: 1200,       // $/ton
    steam_price: 22,       // $/ton
    power_price: 0.08      // $/kWh
};

let tags = { ...TAG_DEFAULTS };
let isStreaming = true;
let isOverrideMode = false;
let updateInterval = null;
let currentTab = 'performance';
let trendChart = null;

// History buffer for Chart.js
const maxHistory = 15;
let chartLabels = [];
let chartActualData = [];
let chartGoldenData = [];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const modeStreamBtn = document.getElementById('mode-stream-btn');
const modeManualBtn = document.getElementById('mode-manual-btn');
const simLeakBtn = document.getElementById('sim-leak-btn');
const simFoulingBtn = document.getElementById('sim-fouling-btn');
const simFeedBtn = document.getElementById('sim-feed-btn');
const simOptimizeBtn = document.getElementById('sim-optimize-btn');
const simResetBtn = document.getElementById('sim-reset-btn');
const toastContainer = document.getElementById('toast-container');

// Tab toggles
const tabTrend = document.getElementById('tab-trend');
const tabContributors = document.getElementById('tab-contributors');

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
    initSliders();
    initChart();
    
    // Set actual and optimum times
    document.getElementById('opt-time-display').textContent = '26-JUN-26 12:00 PM';
    const now = new Date();
    document.getElementById('act-time-display').textContent = formatPlantTime(now);

    // Start Live Simulator
    startSimulator();
    showToast("Digital Twin connected to OSIsoft PI Server successfully.", "success");
});

function formatPlantTime(date) {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = date.getDate().toString().padStart(2, '0');
    const m = months[date.getMonth()];
    const y = date.getFullYear().toString().substring(2);
    let hrs = date.getHours();
    const mins = date.getMinutes().toString().padStart(2, '0');
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12; // 0 should be 12
    return `${d}-${m}-${y} ${hrs.toString().padStart(2, '0')}:${mins} ${ampm}`;
}

// Initialize Sidebar sliders and override behavior
function initSliders() {
    const sliders = sidebar.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const tag = slider.id.replace('tag-', '').toUpperCase();
        // find matching tag from state
        const matchingTagKey = Object.keys(tags).find(k => k.includes(tag));
        if (matchingTagKey) {
            slider.value = tags[matchingTagKey];
            updateSliderLabel(slider, tags[matchingTagKey], matchingTagKey);
        }

        slider.addEventListener('input', (e) => {
            if (isOverrideMode) {
                const val = parseFloat(e.target.value);
                const tagKey = Object.keys(tags).find(k => k.includes(tag));
                tags[tagKey] = val;
                updateSliderLabel(slider, val, tagKey);
                recomputeAll();
            }
        });
    });
}

function updateSliderLabel(slider, val, tagKey) {
    const labelSpan = document.getElementById(`val-${slider.id.replace('tag-', '')}`);
    if (labelSpan) {
        let unit = '';
        if (tagKey.includes('FEED') || tagKey.includes('VENT')) unit = ' kg/h';
        else if (tagKey.includes('OUT') || tagKey.includes('MELT') || tagKey.includes('EXT')) unit = ' t/h';
        else if (tagKey.includes('HP_C') || tagKey.includes('MP_C')) unit = ' t/h';
        else if (tagKey.includes('RXT_SHELL')) unit = ' MPa';
        else if (tagKey.includes('VAC') && tagKey.includes('PT_C')) unit = ' kPa';
        else if (tagKey.includes('DEEPVAC')) unit = ' mbar';
        else if (tagKey.includes('FILTER')) unit = ' MPa';
        else if (tagKey.includes('TORQ')) unit = ' Nm';
        else if (tagKey.includes('RPM')) unit = ' RPM';
        else if (tagKey.includes('AGIT')) unit = ' kW';
        else if (tagKey.includes('YI')) unit = ' YI';
        else if (tagKey.includes('MFI')) unit = ' g/10m';

        labelSpan.textContent = `${val.toFixed(val < 10 ? 2 : 0)}${unit}`;
    }
}

// Synchronize sliders with tags state
function syncSlidersToTags() {
    const sliders = sidebar.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const tag = slider.id.replace('tag-', '').toUpperCase();
        const tagKey = Object.keys(tags).find(k => k.includes(tag));
        if (tagKey) {
            slider.value = tags[tagKey];
            updateSliderLabel(slider, tags[tagKey], tagKey);
        }
    });
}

function initEventListeners() {
    // Sidebar toggles
    openSidebarBtn.addEventListener('click', () => sidebar.classList.remove('collapsed'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('collapsed'));

    // Mode switchers
    modeStreamBtn.addEventListener('click', () => {
        isOverrideMode = false;
        isStreaming = true;
        modeStreamBtn.classList.add('active');
        modeManualBtn.classList.remove('active');
        toggleSlidersDisabled(true);
        startSimulator();
        showToast("DCS Stream active. Tag overrides locked.", "info");
    });

    modeManualBtn.addEventListener('click', () => {
        isOverrideMode = true;
        isStreaming = false;
        modeStreamBtn.classList.remove('active');
        modeManualBtn.classList.add('active');
        toggleSlidersDisabled(false);
        stopSimulator();
        showToast("DCS overrides unlocked. Adjust sliders manually.", "warning");
    });

    // Anomaly Triggers
    simLeakBtn.addEventListener('click', () => {
        tags['500_PT_R510_DEEPVAC'] = 2.10; // Serious vacuum leak
        tags['500_EI_P510_TORQ'] = 1450;    // Increased torque due to viscosity fluctuation
        tags['500_SE_P510_RPM'] = 45.0;
        syncSlidersToTags();
        recomputeAll();
        showToast("Vacuum Ingress simulated! Quality Index degrading.", "danger");
    });

    simFoulingBtn.addEventListener('click', () => {
        // High fouling factor means heat transfer is impaired, forcing higher steam flow to maintain reboiler temp
        tags['300_FT_ST_MP_C310'] = 21.8;   // High steam flow
        tags['300_TT_C310_REB_OUT'] = 201.2; // Dropping outlet temperature
        syncSlidersToTags();
        recomputeAll();
        showToast("Reboiler fouling anomaly injected. Steam efficiency compromised.", "danger");
    });

    simFeedBtn.addEventListener('click', () => {
        // Upstream supply trip drops feed flow rates
        tags['100_FT_001_EO_FEED'] = 16000;
        tags['100_FT_002_CO2_FEED'] = 18000;
        tags['400_FT_001_BPA_MELT'] = 20.5;
        tags['500_FT_090_PC_EXT'] = 21.0;  // Extruder speed drops due to monomer shortage
        syncSlidersToTags();
        recomputeAll();
        showToast("Upstream Feed starvation! Capacity utilization drops.", "warning");
    });

    simOptimizeBtn.addEventListener('click', () => {
        optimizeSetpoints();
    });

    simResetBtn.addEventListener('click', () => {
        tags = { ...TAG_DEFAULTS };
        syncSlidersToTags();
        recomputeAll();
        showToast("Simulation parameters reset to standard baseline.", "info");
    });

    // Action buttons in Table
    document.getElementById('btn-action-wash').addEventListener('click', () => {
        tags['300_FT_ST_MP_C310'] = GOLDEN_RUN['300_FT_ST_MP_C310'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Reboiler decoking cycle completed. Heat transfer restored.", "success");
    });

    document.getElementById('btn-action-vac').addEventListener('click', () => {
        tags['500_PT_R510_DEEPVAC'] = GOLDEN_RUN['500_PT_R510_DEEPVAC'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Vacuum ejector motive steam adjusted. Vacuum stabilized.", "success");
    });

    document.getElementById('btn-action-speed').addEventListener('click', () => {
        tags['500_SE_P510_RPM'] = GOLDEN_RUN['500_SE_P510_RPM'];
        tags['500_EI_P510_TORQ'] = GOLDEN_RUN['500_EI_P510_TORQ'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Discharge pump and extruder speed synced to optimum curve.", "success");
    });

    // Tab selectors
    tabTrend.addEventListener('click', () => {
        tabTrend.classList.add('active');
        tabContributors.classList.remove('active');
        updateChartConfig('trend');
    });

    tabContributors.addEventListener('click', () => {
        tabTrend.classList.remove('active');
        tabContributors.classList.add('active');
        updateChartConfig('contributors');
    });
}

function toggleSlidersDisabled(disabled) {
    const sliders = sidebar.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => slider.disabled = disabled);
}

function startSimulator() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        simulateDCSFlow();
    }, 2000);
}

function stopSimulator() {
    if (updateInterval) clearInterval(updateInterval);
}

// Simulate small fluctuations + dynamic updates like DCS historian tags
function simulateDCSFlow() {
    // Add minor random walk to mimic real-time sensor jitter
    const walk = (val, maxStep, min, max) => {
        let step = (Math.random() - 0.5) * 2 * maxStep;
        let next = val + step;
        return Math.min(Math.max(next, min), max);
    };

    tags['100_FT_001_EO_FEED'] = walk(tags['100_FT_001_EO_FEED'], 100, 15000, 30000);
    tags['100_FT_002_CO2_FEED'] = walk(tags['100_FT_002_CO2_FEED'], 100, 18000, 32000);
    tags['200_FT_ST_HP_C210'] = walk(tags['200_FT_ST_HP_C210'], 0.05, 10, 25);
    tags['300_FT_ST_MP_C310'] = walk(tags['300_FT_ST_MP_C310'], 0.05, 10, 25);
    tags['300_PT_C320_VAC'] = walk(tags['300_PT_C320_VAC'], 0.1, 15, 45);
    tags['400_FT_001_BPA_MELT'] = walk(tags['400_FT_001_BPA_MELT'], 0.1, 20, 40);
    tags['500_PT_R510_DEEPVAC'] = walk(tags['500_PT_R510_DEEPVAC'], 0.01, 0.05, 3.0);
    tags['500_EI_P510_TORQ'] = walk(tags['500_EI_P510_TORQ'], 10, 800, 2000);
    
    // Pump speed holds steady based on controller, add very minor noise
    tags['500_SE_P510_RPM'] = walk(tags['500_SE_P510_RPM'], 0.05, 20, 60);

    // Sync state to UI sliders
    syncSlidersToTags();
    recomputeAll();
}

// Primary calculation stack: First-principles physics + soft sensors
function recomputeAll() {
    // 1. Monomer Plant calculations
    const freshEO = tags['100_FT_001_EO_FEED'];
    const freshCO2 = tags['100_FT_002_CO2_FEED'];
    const bpaFeed = tags['400_FT_001_BPA_MELT'];
    const pcExtrusion = tags['500_FT_090_PC_EXT'];
    const dmcOut = tags['200_FT_020_DMC_OUT'];
    const dpcOut = tags['300_FT_040_DPC_OUT'];
    
    // Molar flows (estimate based on approximate MW)
    // MWs: EO=44.05, CO2=44.01, DMC=90.08, DPC=214.22, Phenol=94.11, BPA=228.29, PC=254.3 (monomer unit)
    const eo_molar = freshEO / 44.05;
    const co2_molar = (freshCO2 - tags['100_FT_003_CO2_VENT']) / 44.01;
    const phenol_in_molar = (tags['300_FT_001_PHENOL_IN'] * 1000) / 94.11;
    const dpc_produced_molar = (dpcOut * 1000) / 214.22;
    
    // η_DPC (Reaction Selectivity to DPC)
    // Assume stoichiometric ratio mapping. In typical state:
    let eta_dpc = (dpc_produced_molar / (phenol_in_molar || 1)) * 2 * 100;
    // clip selectivity to realistic ranges
    eta_dpc = Math.min(Math.max(eta_dpc, 85.0), 99.8);

    // 2. Specific Steam Consumption (SSC) for DMC & DPC
    const HP_steam = tags['200_FT_ST_HP_C210'];
    const LP_steam = tags['200_FT_ST_LP_C220'];
    const RD_steam = tags['300_FT_ST_MP_C310'] + tags['300_FT_ST_MP_C320'];
    const total_steam = HP_steam + LP_steam + RD_steam;
    const ssc = total_steam / (dpcOut || 1);

    // 3. Specific Vacuum Power Intensity (SVPI)
    // Motive Steam: 500_FT_ST_EJ_MOTIVE (kg/h), convert to kW heat duty (approx 2200 kJ/kg latent heat)
    const motive_steam_kW = (tags['500_FT_ST_EJ_MOTIVE'] * 2200) / 3600; // kW
    const pump_electric_kW = tags['500_JI_P510_GEAR'] * 0.15; // approximate fraction representing vacuum pump motors
    const svpi = (motive_steam_kW + pump_electric_kW) / (pcExtrusion || 1);

    // 4. Heat Exchanger Fouling Factor (Rf) (C-310 reboilers proxy)
    // Heat duty: Q = m_steam * Latent heat
    const Q_reboiler = (tags['300_FT_ST_MP_C310'] * 1000 * 2100) / 3600; // kW
    // LMTD calculation: reboiler shell is steam at C310_ST_IN, outlet C310_ST_OUT
    // process side IN to OUT.
    const T_steam = tags['300_TT_C310_ST_IN'];
    const T_proc_in = tags['300_TT_C310_REB_IN'];
    const T_proc_out = tags['300_TT_C310_REB_OUT'];
    const dt1 = T_steam - T_proc_in;
    const dt2 = T_steam - T_proc_out;
    const lmtd = (dt1 - dt2) / Math.log(dt1 / (dt2 || 1));
    const area = 240; // m2
    const u_actual = Q_reboiler / (area * (lmtd || 1)); // kW/m2 K
    // base clean U = 3.8 kW/m2 K
    const u_clean = 3.8;
    let rf = (1 / (u_actual || 1)) - (1 / u_clean);
    // clip Rf to realistic boundaries
    rf = Math.min(Math.max(rf, 0.0005), 0.012);

    // 5. Wetting Uniformity Index (WUI)
    // Fluctuates based on vacuum pressure drift and pump torque variance
    const deepvac = tags['500_PT_R510_DEEPVAC'];
    let wui = 0.96 - (deepvac > 0.5 ? (deepvac - 0.5) * 0.08 : 0);
    // Add minor variance noise
    wui -= (tags['500_EI_P510_TORQ'] % 10) * 0.001;
    wui = Math.min(Math.max(wui, 0.5), 0.98);

    // 6. Volumetric Gear Pump Efficiency (η_v)
    // Volumetric flow = Mass / density (density approx 1080 kg/m3)
    const density = 1080; // kg/m3
    const rpm = tags['500_SE_P510_RPM'];
    const displacement = 0.012; // m3/rev
    const theoretical_flow = (rpm * 60) * displacement * (density / 1000); // t/h
    let eta_v = (pcExtrusion / (theoretical_flow || 1)) * 100;
    // In deep vacuum, slip increases, efficiency drops
    if (deepvac > 0.8) eta_v -= (deepvac - 0.8) * 15;
    eta_v = Math.min(Math.max(eta_v, 65.0), 96.5);

    // 7. Soft Sensors: predicted YI and MFI
    // Predicted YI climbs with temperature, residence time, and poor vacuum
    let pred_yi = 0.85 + (deepvac * 0.3) + (tags['500_EI_P510_TORQ'] > 1300 ? 0.2 : 0);
    if (HP_steam > 18) pred_yi += (HP_steam - 18) * 0.08; // thermal cracking in DMC preheaters
    
    // Predicted MFI relates to DPC/BPA stoichiometry and reactor parameters
    let pred_mfi = 15.0 - (deepvac - 0.18) * 1.5;
    pred_mfi = Math.min(Math.max(pred_mfi, 9.5), 18.0);

    // 8. Net Carbon Dioxide Utilization Index (CDUI)
    // EO + CO2 + BPA -> PC + MEG
    // Tracks mass ratio of CO2 fixed in Unit 100 minus purge vents
    const cdui = (freshCO2 - tags['100_FT_003_CO2_VENT']) / (pcExtrusion || 1) / 1000; // t/t

    // 9. Overall Efficiencies for top card calculations
    const process_efficiency = 100 - (100 - eta_dpc) * 0.5 - (pred_yi > 1.5 ? (pred_yi - 1.5) * 5 : 0);
    const energy_efficiency = 98.0 - (ssc - 2.50) * 12.0 - (svpi - 105.0) * 0.12;
    const environment_efficiency = 99.5 - (tags['100_FT_003_CO2_VENT'] / freshCO2) * 150;

    // Opportunities calculations
    const prod_opportunity = (32.50 - pcExtrusion) * 24; // MT/day
    // energy: GJ/day reduction = (SEC_actual - SEC_opt) * Production
    const sec_actual = ssc * 2.1 + (svpi * 3600) / 1000000;
    const sec_opt = 2.15;
    const energy_opportunity = Math.max(0, (sec_actual - sec_opt) * pcExtrusion * 24 * 0.95);
    const co2_opportunity = Math.max(0, (tags['100_FT_003_CO2_VENT'] * 24) / 1000); // tons/day

    // 10. Business KPIs: Operating Margin ($/hr)
    const revenues = (pcExtrusion * ECONOMICS.pc_price) + (tags['200_FT_030_MEG_OUT'] * ECONOMICS.meg_price);
    const raw_costs = (freshEO / 1000 * ECONOMICS.eo_price) + (freshCO2 / 1000 * ECONOMICS.co2_price) + (bpaFeed * ECONOMICS.bpa_price);
    const utility_costs = (total_steam * ECONOMICS.steam_price) + (tags['GEN_JI_TOTAL_KW'] || 22000) * ECONOMICS.power_price;
    const margin = revenues - raw_costs - utility_costs;

    // Update UI elements
    updateUIElements({
        process_efficiency,
        energy_efficiency,
        environment_efficiency,
        prod_opportunity,
        energy_opportunity,
        co2_opportunity,
        eta_dpc,
        ssc,
        svpi,
        rf,
        wui,
        eta_v,
        pred_yi,
        pred_mfi,
        cdui,
        margin
    });

    // Record data sample for Chart.js
    recordHistorySample(pred_yi);
}

function updateUIElements(calc) {
    // 1. Top Card Gauges & Metrics
    updateRadialGauge('radial-process-pct', 'val-process-pct', calc.process_efficiency);
    updateRadialGauge('radial-energy-pct', 'val-energy-pct', calc.energy_efficiency);
    updateRadialGauge('radial-env-pct', 'val-env-pct', calc.environment_efficiency);

    document.getElementById('val-prod-opp').innerHTML = `${calc.prod_opportunity.toFixed(2)} <span class="unit">MT/DAY</span>`;
    document.getElementById('val-energy-opp').innerHTML = `${calc.energy_opportunity.toFixed(2)} <span class="unit">GJ/DAY</span>`;
    document.getElementById('val-co2-opp').innerHTML = `${calc.co2_opportunity.toFixed(2)} <span class="unit">MT/DAY</span>`;

    // 2. Performance Panel Values
    document.getElementById('val-perf-excess-steam').textContent = Math.max(0, (calc.ssc - 2.50) * tags['300_FT_040_DPC_OUT']).toFixed(2);
    document.getElementById('val-perf-dpc-select').textContent = calc.eta_dpc.toFixed(2);
    document.getElementById('val-perf-overall-eff').textContent = calc.process_efficiency.toFixed(2);
    document.getElementById('val-perf-sec').textContent = (calc.ssc * 2.1 + (calc.svpi * 3600) / 1000000 * 0.25).toFixed(2);
    document.getElementById('val-perf-pc-prod').textContent = tags['500_FT_090_PC_EXT'].toFixed(2);
    document.getElementById('val-perf-cap-util').textContent = `${(tags['500_FT_090_PC_EXT'] / 32.5 * 100).toFixed(1)}%`;

    // 3. Predicted Panel Values
    const predYiSpan = document.getElementById('val-pred-yi');
    predYiSpan.textContent = calc.pred_yi.toFixed(2);
    if (calc.pred_yi > 1.5) {
        predYiSpan.className = 'actual danger';
    } else if (calc.pred_yi > 1.25) {
        predYiSpan.className = 'actual alert';
    } else {
        predYiSpan.className = 'actual';
    }

    document.getElementById('val-pred-mfi').textContent = calc.pred_mfi.toFixed(2);
    document.getElementById('val-pred-film-thick').textContent = (0.2 + (tags['500_EI_P510_TORQ'] / 1500) * 0.1).toFixed(2);
    
    const wuiSpan = document.getElementById('val-pred-wui');
    wuiSpan.textContent = calc.wui.toFixed(2);
    wuiSpan.className = calc.wui < 0.90 ? 'actual alert' : 'actual';

    const rfSpan = document.getElementById('val-pred-rf');
    rfSpan.textContent = calc.rf.toFixed(4);
    rfSpan.className = calc.rf > 0.0035 ? 'actual alert' : 'actual';

    document.getElementById('val-pred-pump-eff').textContent = calc.eta_v.toFixed(1);

    // 4. Parameter Columns Details
    document.getElementById('val-param-hp-steam').textContent = tags['200_FT_ST_HP_C210'].toFixed(2);
    document.getElementById('val-param-hp-press').textContent = tags['100_PT_012_RXT_SHELL'].toFixed(2); // approximate proxy
    document.getElementById('val-param-lp-steam').textContent = tags['200_FT_ST_LP_C220'].toFixed(2);
    
    document.getElementById('val-param-rd-steam').textContent = tags['300_FT_ST_MP_C310'].toFixed(2);
    document.getElementById('val-param-rd-temp').textContent = tags['300_TT_C310_REB_OUT'].toFixed(2);
    document.getElementById('val-param-rd-vac').textContent = tags['300_PT_C320_VAC'].toFixed(2);

    const deepvacSpan = document.getElementById('val-param-deepvac');
    deepvacSpan.textContent = tags['500_PT_R510_DEEPVAC'].toFixed(2);
    deepvacSpan.className = tags['500_PT_R510_DEEPVAC'] > 0.5 ? 'actual alert' : 'actual';

    document.getElementById('val-param-pump-rpm').textContent = tags['500_SE_P510_RPM'].toFixed(2);
    document.getElementById('val-param-pump-torque').textContent = tags['500_EI_P510_TORQ'].toFixed(0);

    // 5. Dynamic Alarm and Deviation calculations
    let activeDevs = 0;
    const alarms = [];

    if (calc.pred_yi > 1.5) {
        activeDevs++;
        alarms.push("Quality Index Drift: High yellowing risk.");
    }
    if (tags['500_PT_R510_DEEPVAC'] > 0.5) {
        activeDevs++;
        alarms.push("Gravity finishing vacuum pressure exceeds target limit.");
    }
    if (calc.rf > 0.0035) {
        activeDevs++;
        alarms.push("High heat-exchanger fouling factor on Unit 300 reboilers.");
    }
    if (calc.eta_v < 90.0) {
        activeDevs++;
        alarms.push("Discharge gear pump cavitation alert.");
    }

    document.getElementById('val-active-devs').textContent = activeDevs;
    const alertGlow = document.getElementById('alert-glow');
    const alertIcon = document.getElementById('alert-icon');
    const alertIndicator = document.getElementById('quality-alert-indicator');

    if (activeDevs > 0) {
        alertGlow.className = 'alert-icon-circle triggered';
        alertIcon.className = 'fa-solid fa-triangle-exclamation';
        alertIndicator.style.display = 'flex';
        // update unit statuses to warning
        document.getElementById('status-u500').className = tags['500_PT_R510_DEEPVAC'] > 0.5 ? 'status-item warning' : 'status-item active';
        document.getElementById('status-u300').className = calc.rf > 0.0035 ? 'status-item warning' : 'status-item active';
    } else {
        alertGlow.className = 'alert-icon-circle';
        alertIcon.className = 'fa-solid fa-circle-check';
        alertIndicator.style.display = 'none';
        
        document.getElementById('status-u500').className = 'status-item active';
        document.getElementById('status-u300').className = 'status-item active';
    }

    // 6. Actionables Table Rows rebuilding
    rebuildActionablesTable(calc);
}

function updateRadialGauge(circleId, labelId, pct) {
    const circle = document.getElementById(circleId);
    const label = document.getElementById(labelId);
    const val = Math.min(Math.max(pct, 0), 100);
    
    if (label) {
        label.textContent = `${val.toFixed(2)} %`;
    }
    
    if (circle) {
        circle.setAttribute('stroke-dasharray', `${val.toFixed(2)}, 100`);
    }
    
    // update colors
    if (label) {
        const isHighlight = label.closest('.metric-card')?.classList.contains('highlight');
        if (!isHighlight) {
            if (val < 90) {
                label.style.color = 'var(--color-red)';
                if (circle) circle.style.stroke = 'var(--color-red)';
            } else if (val < 96) {
                label.style.color = 'var(--color-orange)';
                if (circle) circle.style.stroke = 'var(--color-orange)';
            } else {
                label.style.color = 'var(--color-cyan)';
                if (circle) circle.style.stroke = 'var(--color-cyan)';
            }
        } else {
            label.style.color = '#ffffff';
        }
    }
}

function rebuildActionablesTable(calc) {
    const tbody = document.getElementById('action-table-body');
    tbody.innerHTML = '';

    // Action 1: Fouling
    if (calc.rf > 0.0035) {
        tbody.innerHTML += `
            <tr>
                <td class="bold font-danger">Specific Steam / Excess Reboiler Load</td>
                <td>High fouling resistance R_f on C-310 reboilers</td>
                <td>${calc.rf.toFixed(4)} m²K/W</td>
                <td>0.0011 m²K/W</td>
                <td>High thermal resistance detected in Unit 300 reboiler. Click to clean reboiler surfaces.</td>
                <td><button class="action-trigger-btn font-danger" onclick="executePrescriptiveAction('wash')" title="Clean Reboilers"><i class="fa-solid fa-soap"></i> Clean</button></td>
            </tr>
        `;
    }

    // Action 2: Vacuum
    if (tags['500_PT_R510_DEEPVAC'] > 0.40) {
        tbody.innerHTML += `
            <tr>
                <td class="bold font-warning">Vacuum Loss / Low Wetting Index</td>
                <td>Finishing Reactor vacuum leak (air ingress)</td>
                <td>${tags['500_PT_R510_DEEPVAC'].toFixed(2)} mbar</td>
                <td>0.18 mbar</td>
                <td>Reactor pressure is high. Click to apply closed-loop vacuum compensation.</td>
                <td><button class="action-trigger-btn font-warning" onclick="executePrescriptiveAction('vac')" title="Seal Vacuum"><i class="fa-solid fa-wrench"></i> Seal</button></td>
            </tr>
        `;
    }

    // Action 3: Pump
    if (calc.eta_v < 92.0) {
        tbody.innerHTML += `
            <tr>
                <td class="bold text-success">Specific Power / Flow Cavitation</td>
                <td>High discharge gear pump speed & torque drag</td>
                <td>${calc.eta_v.toFixed(1)}%</td>
                <td>95.0%</td>
                <td>Pump volumetric efficiency degraded. Click to trim RPM setpoint.</td>
                <td><button class="action-trigger-btn text-success" onclick="executePrescriptiveAction('speed')" title="Trim Speed"><i class="fa-solid fa-gauge-low"></i> Trim</button></td>
            </tr>
        `;
    }

    if (tbody.innerHTML === '') {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-shield-halved" style="font-size: 20px; margin-bottom: 8px; display: block; color: var(--color-green);"></i>
                    All process variables aligned with optimum "Golden Run" targets. No active deviations.
                </td>
            </tr>
        `;
    }
}

// Actions triggered by operator inside table
window.executePrescriptiveAction = function(actionType) {
    if (actionType === 'wash') {
        tags['300_FT_ST_MP_C310'] = GOLDEN_RUN['300_FT_ST_MP_C310'];
        tags['300_TT_C310_REB_OUT'] = GOLDEN_RUN['300_TT_C310_REB_OUT'];
        tags['300_TT_C310_REB_IN'] = GOLDEN_RUN['300_TT_C310_REB_IN'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Reboiler clean-in-place (CIP) cycle completed successfully.", "success");
    } else if (actionType === 'vac') {
        tags['500_PT_R510_DEEPVAC'] = GOLDEN_RUN['500_PT_R510_DEEPVAC'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Motive steam valve throttled. Finishing reactor vacuum restored to 0.18 mbar.", "success");
    } else if (actionType === 'speed') {
        tags['500_SE_P510_RPM'] = GOLDEN_RUN['500_SE_P510_RPM'];
        tags['500_EI_P510_TORQ'] = GOLDEN_RUN['500_EI_P510_TORQ'];
        syncSlidersToTags();
        recomputeAll();
        showToast("Discharge pump speeds matched to optimum target curve.", "success");
    }
};

function optimizeSetpoints() {
    // Smooth transition to Golden Run
    const steps = 10;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        Object.keys(GOLDEN_RUN).forEach(k => {
            if (tags[k] !== undefined) {
                tags[k] = tags[k] + (GOLDEN_RUN[k] - tags[k]) * (step / steps);
            }
        });
        syncSlidersToTags();
        recomputeAll();

        if (step >= steps) {
            clearInterval(interval);
            showToast("NMPC Closed-Loop optimization complete. All setpoints normalized.", "success");
        }
    }, 100);
}

// Chart.js Configuration
function initChart() {
    const ctx = document.getElementById('trend-chart').getContext('2d');
    
    // Seed initial history buffer
    for (let i = maxHistory; i > 0; i--) {
        const timeStr = new Date(Date.now() - i * 10000);
        chartLabels.push(timeStr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        chartActualData.push(1.10 + (Math.random() - 0.5) * 0.1);
        chartGoldenData.push(0.95);
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Actual / Estimated',
                    data: chartActualData,
                    borderColor: '#00a3e0',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Golden Run Target',
                    data: chartGoldenData,
                    borderColor: '#94a3b8',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                },
                y: {
                    grid: { color: 'rgba(0, 0, 0, 0.07)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                }
            }
        }
    });
}

function recordHistorySample(actualVal) {
    if (!trendChart) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    chartLabels.push(timeStr);
    chartActualData.push(actualVal);
    chartGoldenData.push(0.95); // Golden Run constant target

    if (chartLabels.length > maxHistory) {
        chartLabels.shift();
        chartActualData.shift();
        chartGoldenData.shift();
    }

    trendChart.update();
}

function updateChartConfig(type) {
    if (!trendChart) return;

    if (type === 'contributors') {
        // Switch to bar chart representing steam distribution
        document.getElementById('chart-title').textContent = 'STEAM UTILITIES DISTRIBUTION (MT/h)';
        trendChart.config.type = 'bar';
        trendChart.data.datasets = [
            {
                label: 'Steam Consumption',
                data: [
                    tags['200_FT_ST_HP_C210'], // HP C210
                    tags['200_FT_ST_LP_C220'], // LP C220
                    tags['300_FT_ST_MP_C310'], // MP C310
                    tags['300_FT_ST_MP_C320']  // MP C320
                ],
                backgroundColor: ['#00a3e0', '#38bdf8', '#0284c7', '#0369a1'],
                borderRadius: 4
            }
        ];
        trendChart.data.labels = ['HP Column', 'LP Column', 'C-310 column', 'C-320 column'];
        trendChart.options.scales.x.grid.display = false;
    } else {
        // Switch back to line trend chart
        document.getElementById('chart-title').textContent = 'YELLOWNESS INDEX (YI) SOFT SENSOR PREDICTION';
        trendChart.config.type = 'line';
        trendChart.data.labels = chartLabels;
        trendChart.data.datasets = [
            {
                label: 'Actual / Estimated',
                data: chartActualData,
                borderColor: '#00a3e0',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.3
            },
            {
                label: 'Golden Run Target',
                data: chartGoldenData,
                borderColor: '#94a3b8',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                tension: 0
            }
        ];
        trendChart.options.scales.x.grid.display = true;
    }
    trendChart.update();
}

// Toast alerts helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    else if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    else if (type === 'danger') iconClass = 'fa-skull-crossbones';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-msg">${message}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
