import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

export default function TamilNaduLiveMap() {
    const [geoData, setGeoData] = useState(null);
    const [liveData, setLiveData] = useState([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        fetch("/data/tn-234-constituencies.geojson")
            .then((res) => res.json())
            .then((data) => {
                console.log("GeoJSON loaded:", data?.features?.length);
                setGeoData(data);
            })
            .catch((err) => console.error("GeoJSON load error:", err));
    }, []);

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await fetch("http://localhost:3000/constituencies");
                const data = await res.json();
                console.log("Live data loaded:", data?.length);
                setLiveData(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Live data fetch error:", err);
            }
        };

        fetchLive();
        const interval = setInterval(fetchLive, 30000);
        return () => clearInterval(interval);
    }, []);

    const normalizeName = (value) =>
        String(value || "")
            .toLowerCase()
            .replace(/\(sc\)|\(st\)/g, "")
            .replace(/[^a-z0-9]/g, "");

    const partyColors = {
        DMK: "#e11d48",
        AIADMK: "#16a34a",
        BJP: "#f59e0b",
        INC: "#2563eb",
        NTK: "#7c3aed",
        PMK: "#ea580c",
        VCK: "#0f766e",
        CPI: "#dc2626",
        CPM: "#b91c1c",
        AMMK: "#92400e",
        DMDK: "#1d4ed8",
        MNM: "#0891b2",
        TVK: "#be123c",
    };

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
                    item.name.toLowerCase().includes(query) ||
                    item.district.toLowerCase().includes(query)
                );
            })
            .sort((a, b) => {
                if (b.alertCount !== a.alertCount) {
                    return b.alertCount - a.alertCount;
                }
                return a.constituencyNo - b.constituencyNo;
            });
    }, [liveData, search]);

    const styleFeature = (feature) => {
        const match = getLiveRecord(feature);
        const acNo = Number(feature?.properties?.AC_NO || 0);
        const isSelected = selected?.constituencyNo === acNo;

        return {
            fillColor: match ? partyColors[match.party] || "#9CA3AF" : "#9CA3AF",
            fillOpacity: isSelected ? 0.95 : 0.7,
            color: isSelected ? "#000000" : "#111827",
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
                winningMargin: "N/A",
                sentiment: "N/A",
                alertCount: 0,
            };

        const popupHtml = `
      <div>
        <strong>${acNo} - ${acName}</strong><br/>
        District: ${district}<br/>
        ${match
                ? `Party: ${match.party}<br/>
               MLA: ${match.mla}<br/>
               Alliance: ${match.alliance}<br/>
               Sentiment: ${match.sentiment}<br/>
               Alerts: ${match.alertCount}`
                : "No live data"
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

    const handleSidebarClick = (item) => {
        setSelected(item);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                {Object.entries(
                    liveData.reduce((acc, item) => {
                        acc[item.party] = (acc[item.party] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([party, count]) => (
                    <div
                        key={party}
                        className="rounded-xl bg-white p-3 shadow-sm border"
                    >
                        <div className="flex items-center justify-between">
                            <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={{ backgroundColor: partyColors[party] || "#9CA3AF" }}
                            />
                            <span className="text-sm font-semibold text-gray-500">
                                {party}
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-gray-900">{count}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm border h-[78vh] flex flex-col">
                        <h2 className="text-lg font-bold text-gray-900 mb-3">
                            Constituencies
                        </h2>

                        <input
                            type="text"
                            placeholder="Search by constituency or district"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        />

                        <div className="mb-3 text-sm text-gray-500">
                            Showing {constituencyList.length} of {liveData.length}
                        </div>

                        <div className="overflow-y-auto space-y-2 pr-1">
                            {constituencyList.map((item) => {
                                const isSelected =
                                    selected?.constituencyNo === item.constituencyNo;

                                return (
                                    <button
                                        key={item.constituencyNo}
                                        onClick={() => handleSidebarClick(item)}
                                        className={`w-full rounded-xl border p-3 text-left transition ${isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 bg-white hover:bg-gray-50"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-gray-900">
                                                    {item.constituencyNo} - {item.name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {item.district}
                                                </div>
                                            </div>

                                            <span
                                                className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                                                style={{
                                                    backgroundColor:
                                                        partyColors[item.party] || "#9CA3AF",
                                                }}
                                            >
                                                {item.party}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                                            <span>Sentiment: {item.sentiment}</span>
                                            <span
                                                className={`rounded-full px-2 py-1 font-semibold ${item.alertCount > 2
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-700"
                                                    }`}
                                            >
                                                Alerts: {item.alertCount}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
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
                                        key={`geo-${liveData.length}-${selected?.constituencyNo || "none"}`}
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
                        <h2 className="text-lg font-bold text-gray-900 mb-3">
                            Constituency Details
                        </h2>

                        {selected ? (
                            <div className="space-y-3">
                                <div>
                                    <div className="text-sm text-gray-500">Constituency</div>
                                    <div className="text-xl font-bold text-gray-900">
                                        {selected.constituencyNo} - {selected.name}
                                    </div>
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
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                                        {selected.alliance}
                                    </span>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                    <div className="text-sm text-gray-500">District</div>
                                    <div className="font-semibold text-gray-900">
                                        {selected.district}
                                    </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                    <div className="text-sm text-gray-500">MLA</div>
                                    <div className="font-semibold text-gray-900">
                                        {selected.mla}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-gray-50 p-3">
                                        <div className="text-sm text-gray-500">Sentiment</div>
                                        <div className="font-semibold capitalize text-gray-900">
                                            {selected.sentiment}
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-gray-50 p-3">
                                        <div className="text-sm text-gray-500">Alerts</div>
                                        <div className="font-semibold text-gray-900">
                                            {selected.alertCount}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl bg-gray-50 p-3">
                                    <div className="text-sm text-gray-500">Winning Margin</div>
                                    <div className="font-semibold text-gray-900">
                                        {selected.winningMargin}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                                Click a constituency on the map or choose one from the list.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}