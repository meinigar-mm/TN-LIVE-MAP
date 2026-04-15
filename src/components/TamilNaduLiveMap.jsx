import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

export default function TamilNaduLiveMap() {
    const [geoData, setGeoData] = useState(null);
    const [liveData, setLiveData] = useState([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [selectedYear, setSelectedYear] = useState("2021");
    const [selected2026Party, setSelected2026Party] = useState("DMK");

    useEffect(() => {
        fetch("/data/tn-234-constituencies.geojson")
            .then((res) => res.json())
            .then((data) => setGeoData(data))
            .catch((err) => console.error("GeoJSON load error:", err));
    }, []);

    const normalizeName = (value) =>
        String(value || "")
            .toLowerCase()
            .replace(/\(sc\)|\(st\)/g, "")
            .replace(/dr\./g, "dr")
            .replace(/thiru-vi-ka/g, "thiruvika")
            .replace(/chepauk\s*-\s*thiruvallikeni/g, "chepaukthiruvallikeni")
            .replace(/rk\.?nagar/g, "rknagar")
            .replace(/annanagar/g, "annanagar")
            .replace(/tiruvottriyur/g, "tiruvottiyur")
            .replace(/tirukko(y|i)ilur/g, "tirukkoyilur")
            .replace(/[^a-z0-9]/g, "");

    const partyColors = {
        DMK: "#e11d48",
        AIADMK: "#16a34a",
        ADMK: "#16a34a",
        BJP: "#f59e0b",
        INC: "#2563eb",
        NTK: "#7c3aed",
        PMK: "#ea580c",
        TVK: "#0ea5e9",
        VCK: "#14b8a6",
        CPI: "#dc2626",
        CPM: "#b91c1c",
        "CPI(M)": "#b91c1c",
        KMDK: "#8b5cf6",
        KNMDK: "#8b5cf6",
        IUML: "#22c55e",
        MMK: "#f97316",
        DMDK: "#6366f1",
        MDMK: "#a855f7",
        TMC: "#06b6d4",
        AMMK: "#64748b",
        IJK: "#94a3b8",
        PBK: "#475569",
    };

    const getAllianceLabel = (party, allianceValue = "") => {
        const p = String(party || "").toUpperCase();
        const a = String(allianceValue || "").toUpperCase().trim();

        if (!a || a === "NONE") {
            if (["DMK", "INC", "CPI", "CPM", "CPI(M)", "VCK", "IUML", "KMDK", "KNMDK", "MMK", "MDMK"].includes(p)) {
                return "INDIA";
            }
            if (["AIADMK", "ADMK", "BJP", "PMK", "AMMK", "TMC", "IJK", "PBK"].includes(p)) {
                return "NDA";
            }
            if (["TVK", "NTK"].includes(p)) {
                return "OTHERS";
            }
            return "OTHERS";
        }

        return a;
    };

    const normalizeResultYears = (json) => {
        if (!Array.isArray(json?.constituencies)) return [];

        return json.constituencies.map((item) => ({
            constituencyNo: Number(item.constituencyNo),
            name: item.name || "Unknown",
            district: item.district || "Unknown",
            party: item.party || "N/A",
            mla: item.mla || "N/A",
            alliance: item.alliance || getAllianceLabel(item.party),
            winningMargin: Number(item.winningMargin || 0),
            sentiment: item.sentiment || "neutral",
            alertCount: Number(item.alertCount || 0),
        }));
    };

    const normalize2026Data = (json, activeParty) => {
        if (!json || typeof json !== "object") return [];

        const rows = [];

        Object.entries(json).forEach(([district, seats]) => {
            if (!Array.isArray(seats)) return;

            seats.forEach((seat) => {
                const partyBlock = seat?.[activeParty] || null;

                rows.push({
                    constituencyNo: Number(seat.constituencyNo),
                    name: seat.name || "Unknown",
                    district,
                    party: activeParty,
                    mla: partyBlock?.candidate || "N/A",
                    alliance: getAllianceLabel(activeParty, partyBlock?.alliance),
                    winningMargin: 0,
                    sentiment: "neutral",
                    alertCount: 0,
                });
            });
        });

        return rows.sort((a, b) => a.constituencyNo - b.constituencyNo);
    };

    useEffect(() => {
        const loadElectionData = async () => {
            try {
                const res = await fetch(`/data/elections/${selectedYear}.json`);
                const json = await res.json();

                const rows =
                    selectedYear === "2026"
                        ? normalize2026Data(json, selected2026Party)
                        : normalizeResultYears(json);

                setLiveData(rows);

                setSelected((prev) => {
                    if (!prev) return null;
                    const nextSelected = rows.find(
                        (r) => Number(r.constituencyNo) === Number(prev.constituencyNo)
                    );
                    return nextSelected || null;
                });
            } catch (err) {
                console.error("Error loading election data:", err);
                setLiveData([]);
            }
        };

        loadElectionData();
    }, [selectedYear, selected2026Party]);

    const liveMap = useMemo(() => {
        const map = new Map();
        liveData.forEach((item) => {
            map.set(String(item.constituencyNo), item);
        });
        return map;
    }, [liveData]);

    const getLiveRecord = (feature) => {
        const acNo = String(feature?.properties?.AC_NO || "");
        const acName = feature?.properties?.AC_NAME || "";

        let live = liveMap.get(acNo);
        if (live) return live;

        const targetName = normalizeName(acName);
        live = liveData.find((item) => normalizeName(item.name) === targetName);

        return live || null;
    };

    const constituencyList = useMemo(() => {
        const query = search.trim().toLowerCase();

        return [...liveData]
            .filter((item) => {
                if (!query) return true;
                return (
                    String(item.name).toLowerCase().includes(query) ||
                    String(item.district).toLowerCase().includes(query)
                );
            })
            .sort((a, b) => a.constituencyNo - b.constituencyNo);
    }, [liveData, search]);

    const summary = useMemo(() => {
        return {
            totalSeats: liveData.length,
            alliances: new Set(liveData.map((i) => i.alliance)).size,
            positive: liveData.filter((i) => i.sentiment === "positive").length,
            negative: liveData.filter((i) => i.sentiment === "negative").length,
            alerts: liveData.reduce((sum, i) => sum + Number(i.alertCount || 0), 0),
        };
    }, [liveData]);

    const styleFeature = (feature) => {
        const match = getLiveRecord(feature);
        const acNo = Number(feature?.properties?.AC_NO || 0);
        const isSelected = selected?.constituencyNo === acNo;

        return {
            fillColor: match ? partyColors[match.party] || "#9CA3AF" : "#CBD5E1",
            fillOpacity: isSelected ? 0.95 : 0.75,
            color: isSelected ? "#000000" : "#334155",
            weight: isSelected ? 3 : 1,
            opacity: 1,
        };
    };

    const onEachFeature = (feature, layer) => {
        const acNo = Number(feature?.properties?.AC_NO || 0);
        const acName = feature?.properties?.AC_NAME || "Unknown";
        const district = feature?.properties?.DIST_NAME || "Unknown";
        const match = getLiveRecord(feature);

        const selectedData = match
            ? {
                constituencyNo: acNo,
                name: acName,
                district,
                party: match.party,
                mla: match.mla,
                alliance: match.alliance,
                winningMargin: match.winningMargin,
                sentiment: match.sentiment,
                alertCount: match.alertCount,
            }
            : {
                constituencyNo: acNo,
                name: acName,
                district,
                party: "N/A",
                mla: "N/A",
                alliance: "N/A",
                winningMargin: 0,
                sentiment: "N/A",
                alertCount: 0,
            };

        const popupHtml = `
      <div>
        <strong>${acNo}. ${acName}</strong><br/>
        District: ${district}<br/>
        Party: ${selectedData.party}<br/>
        Candidate: ${selectedData.mla}<br/>
        Alliance: ${selectedData.alliance}<br/>
        ${selectedYear === "2026"
                ? `Winning Margin: Not available`
                : `Winning Margin: ${Number(selectedData.winningMargin || 0).toLocaleString()}`
            }
      </div>
    `;

        layer.bindPopup(popupHtml);

        layer.on({
            click: () => {
                setSelected(selectedData);
            },
            mouseover: (e) => {
                e.target.setStyle({
                    weight: 2,
                    fillOpacity: 0.9,
                    color: "#000000",
                });
            },
            mouseout: (e) => {
                e.target.setStyle(styleFeature(feature));
            },
        });
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">
                        Tamil Nadu Election War Room
                    </h1>
                    <p className="text-slate-500">
                        Constituency monitoring across 234 seats
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2"
                    >
                        <option value="2026">2026 Assembly Projection</option>
                        <option value="2021">2021 Assembly Election</option>
                        <option value="2016">2016 Assembly Election</option>
                    </select>

                    {selectedYear === "2026" && (
                        <select
                            value={selected2026Party}
                            onChange={(e) => setSelected2026Party(e.target.value)}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2"
                        >
                            <option value="DMK">DMK View</option>
                            <option value="ADMK">ADMK View</option>
                            <option value="TVK">TVK View</option>
                            <option value="NTK">NTK View</option>
                        </select>
                    )}

                    <div className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 border">
                        {selectedYear} Data
                    </div>

                    <div className="text-sm text-slate-500">
                        {liveData.length} constituencies
                    </div>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="rounded-2xl bg-white p-5 shadow-sm border">
                    <div className="text-sm text-slate-500">TOTAL SEATS</div>
                    <div className="mt-2 text-5xl font-bold">{summary.totalSeats}</div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border">
                    <div className="text-sm text-slate-500">ALLIANCES</div>
                    <div className="mt-2 text-5xl font-bold">{summary.alliances}</div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border">
                    <div className="text-sm text-green-600">POSITIVE</div>
                    <div className="mt-2 text-5xl font-bold">{summary.positive}</div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border">
                    <div className="text-sm text-red-600">NEGATIVE</div>
                    <div className="mt-2 text-5xl font-bold">{summary.negative}</div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border">
                    <div className="text-sm text-amber-600">TOTAL ALERTS</div>
                    <div className="mt-2 text-5xl font-bold">{summary.alerts}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm border h-[78vh] flex flex-col">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">CONSTITUENCIES</h2>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                                {constituencyList.length}
                            </span>
                        </div>

                        <input
                            type="text"
                            placeholder="Search constituency or district..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                        />

                        <div className="overflow-y-auto space-y-3">
                            {constituencyList.length === 0 ? (
                                <div className="py-16 text-center text-slate-500">
                                    No data available for {selectedYear}
                                </div>
                            ) : (
                                constituencyList.map((item) => {
                                    const isSelected =
                                        selected?.constituencyNo === item.constituencyNo;

                                    return (
                                        <button
                                            key={item.constituencyNo}
                                            onClick={() => setSelected(item)}
                                            className={`w-full rounded-2xl border p-4 text-left ${isSelected
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-slate-200 bg-white"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-semibold text-slate-900">
                                                        {item.constituencyNo}. {item.name}
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        {item.district}
                                                    </div>
                                                </div>

                                                <span
                                                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                                                    style={{
                                                        backgroundColor:
                                                            partyColors[item.party] || "#9CA3AF",
                                                    }}
                                                >
                                                    {item.party}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between text-sm">
                                                <span className="capitalize">{item.sentiment}</span>
                                                <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-600">
                                                    {item.alertCount} alerts
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-6">
                    <div className="rounded-2xl overflow-hidden border bg-white shadow-sm">
                        <div style={{ height: "78vh", width: "100%" }}>
                            <MapContainer
                                center={[11.1271, 78.6569]}
                                zoom={7}
                                style={{ height: "100%", width: "100%" }}
                            >
                                <TileLayer
                                    attribution="&copy; OpenStreetMap contributors"
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                {geoData && (
                                    <GeoJSON
                                        key={`geo-${selectedYear}-${selected2026Party}-${liveData.length}-${selected?.constituencyNo || "none"}`}
                                        data={geoData}
                                        style={styleFeature}
                                        onEachFeature={onEachFeature}
                                    />
                                )}
                            </MapContainer>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm border h-[78vh]">
                        <h2 className="mb-4 text-xl font-semibold">CONSTITUENCY DETAILS</h2>

                        {selected ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm text-slate-500">
                                        Constituency #{selected.constituencyNo}
                                    </div>
                                    <div className="text-4xl font-bold">{selected.name}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span
                                        className="rounded-full px-3 py-1 text-sm font-semibold text-white"
                                        style={{
                                            backgroundColor:
                                                partyColors[selected.party] || "#9CA3AF",
                                        }}
                                    >
                                        {selected.party}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                                        {selected.alliance}
                                    </span>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="text-sm text-slate-500">District</div>
                                    <div className="text-2xl font-semibold">{selected.district}</div>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="text-sm text-slate-500">
                                        {selectedYear === "2026" ? "Candidate" : "MLA"}
                                    </div>
                                    <div className="text-2xl font-semibold">
                                        {selected.mla || "N/A"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-sm text-slate-500">Sentiment</div>
                                        <div className="text-xl font-semibold capitalize">
                                            {selected.sentiment}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 p-4">
                                        <div className="text-sm text-slate-500">Alerts</div>
                                        <div className="text-xl font-semibold">
                                            {selected.alertCount}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="text-sm text-slate-500">Winning Margin</div>
                                    <div className="text-3xl font-bold">
                                        {selectedYear === "2026"
                                            ? "Not available"
                                            : Number(selected.winningMargin || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                                Click a constituency on the map or choose one from the list.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}