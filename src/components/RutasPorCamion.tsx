import React, { useEffect, useState } from "react";
import { getClients } from "../services/firebaseService";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// New type: each day maps to an array of routes
interface DayRoute {
  truckNumber: string;
  clientIds: string[];
}

const RutasPorCamion: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  // routes: { [day]: DayRoute[] }
  const [routes, setRoutes] = useState<{
    [day: string]: DayRoute[];
  }>({});
  // numRoutes: { [day]: number }
  const [numRoutes, setNumRoutes] = useState<{ [day: string]: number }>({});

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  // When numRoutes changes, ensure routes array is correct length
  useEffect(() => {
    daysOfWeek.forEach((day) => {
      const n = numRoutes[day] || 1;
      setRoutes((prev) => {
        const arr = prev[day] || [];
        if (arr.length === n) return prev;
        // Grow or shrink array
        const newArr = Array.from({ length: n }, (_, i) =>
          arr[i] || { truckNumber: "", clientIds: [] }
        );
        return { ...prev, [day]: newArr };
      });
    });
    // eslint-disable-next-line
  }, [numRoutes]);

  const handleClientToggle = (day: string, routeIdx: number, clientId: string) => {
    setRoutes((prev) => {
      const arr = prev[day] || [];
      const route = arr[routeIdx] || { truckNumber: "", clientIds: [] };
      const exists = route.clientIds.includes(clientId);
      const newRoute = {
        ...route,
        clientIds: exists
          ? route.clientIds.filter((id) => id !== clientId)
          : [...route.clientIds, clientId],
      };
      const newArr = [...arr];
      newArr[routeIdx] = newRoute;
      return { ...prev, [day]: newArr };
    });
  };

  const handleTruckNumberChange = (day: string, routeIdx: number, value: string) => {
    setRoutes((prev) => {
      const arr = prev[day] || [];
      const route = arr[routeIdx] || { truckNumber: "", clientIds: [] };
      const newRoute = { ...route, truckNumber: value };
      const newArr = [...arr];
      newArr[routeIdx] = newRoute;
      return { ...prev, [day]: newArr };
    });
  };

  const handleNumRoutesChange = (day: string, value: number) => {
    setNumRoutes((prev) => ({ ...prev, [day]: value < 1 ? 1 : value }));
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Rutas por Camión</h2>
      <div className="row">
        {daysOfWeek.map((day) => (
          <div className="col-md-12 mb-4" key={day}>
            <div className="card shadow p-3 mb-3">
              <h5><strong>{day}</strong></h5>
              <div className="mb-3" style={{ maxWidth: 220 }}>
                <label className="form-label"># of Routes</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  value={numRoutes[day] || 1}
                  onChange={(e) => handleNumRoutesChange(day, Number(e.target.value))}
                  placeholder="Enter number of routes"
                />
              </div>
              <div className="row">
                {(routes[day] || [{ truckNumber: "", clientIds: [] }]).map((route, idx) => (
                  <div className="col-md-6 mb-3" key={idx}>
                    <div className="card p-3">
                      <h6>Route #{idx + 1}</h6>
                      <div className="mb-2">
                        <label className="form-label">Truck Number</label>
                        <input
                          type="text"
                          className="form-control"
                          value={route.truckNumber}
                          onChange={(e) => handleTruckNumberChange(day, idx, e.target.value)}
                          placeholder="Enter truck number"
                        />
                      </div>
                      <div>
                        <label className="form-label">Select Clients</label>
                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                          {clients.map((client) => (
                            <div className="form-check" key={client.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`client-${day}-${idx}-${client.id}`}
                                checked={route.clientIds.includes(client.id)}
                                onChange={() => handleClientToggle(day, idx, client.id)}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`client-${day}-${idx}-${client.id}`}
                              >
                                {client.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* You can add a save button here to persist routes if needed */}
    </div>
  );
};

export default RutasPorCamion;
