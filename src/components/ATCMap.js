import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import aircraftData from '../juiced_aircraft.json';

// Custom aircraft icon for markers
const createAircraftIcon = (heading, color, highlighted) => {
  const svgIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading} 12 12)">
        <path d="M12 2 L16 8 L14 8 L14 20 L10 20 L10 8 L8 8 Z" 
              fill="${color}" 
              stroke="#000" 
              stroke-width="1"
              opacity="${highlighted ? '1' : '0.8'}"/>
      </g>
      ${highlighted ? '<circle cx="12" cy="12" r="15" fill="none" stroke="#FFD700" stroke-width="3" opacity="0.6"/>' : ''}
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: highlighted ? 'highlighted-aircraft' : 'aircraft-icon'
  });
};

const ATCMap = ({ currentPlaybackIndex, messageConflicts }) => {
  const [aircraft, setAircraft] = useState(aircraftData);
  const mapRef = useRef(null);

  // Update aircraft highlighting based on transcript mentions
  useEffect(() => {
    if (messageConflicts && messageConflicts.size > 0) {
      const updatedAircraft = aircraft.map(plane => {
        // Check if this aircraft has any conflicts in the message map
        const hasConflict = Array.from(messageConflicts.entries()).some(([key, severity]) => {
          const callsign = key.split('-')[1]; // Extract callsign from "timestamp-callsign" key
          return callsign === plane.callsign;
        });
        
        return {
          ...plane,
          highlighted: hasConflict,
          conflict: hasConflict
        };
      });
      
      setAircraft(updatedAircraft);
    }
  }, [messageConflicts]);

  // Get marker color based on aircraft status
  const getAircraftColor = (aircraft) => {
    if (aircraft.conflict) return '#dc2626'; // Red for conflicts
    if (aircraft.highlighted) return '#f59e0b'; // Yellow for highlighted
    return '#10b981'; // Green for normal
  };

  // SFO coordinates
  const sfoCenter = [37.6213, -122.3790];

  return (
    <div style={{ 
      border: '2px solid #000000', 
      backgroundColor: '#ffffff',
      height: '500px'
    }}>
      <h2 style={{ 
        margin: '0 0 1rem 0', 
        padding: '1.5rem 1.5rem 0 1.5rem',
        fontSize: '1.5rem', 
        fontWeight: '400', 
        color: '#000000',
        fontFamily: 'serif'
      }}>
        Live Aircraft Tracking
      </h2>
      
      <div style={{ height: '430px', margin: '0 1.5rem 1.5rem 1.5rem' }}>
        <MapContainer
          center={sfoCenter}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          zoomControl={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          scrollWheelZoom={false}
          boxZoom={false}
          keyboard={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* SFO Airport Marker */}
          <CircleMarker
            center={sfoCenter}
            radius={8}
            pathOptions={{
              color: '#000000',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Tooltip permanent>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                SFO
              </div>
            </Tooltip>
          </CircleMarker>

          {/* Aircraft Markers */}
          {aircraft.map((plane) => {
            const color = getAircraftColor(plane);
            const icon = createAircraftIcon(plane.heading, color, plane.highlighted);
            
            return (
              <React.Fragment key={plane.callsign}>
                {/* Aircraft Marker */}
                <Marker
                  position={[plane.lat, plane.lon]}
                  icon={icon}
                >
                  <Popup>
                    <div style={{ minWidth: '150px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                        {plane.callsign}
                      </div>
                      <div><strong>Altitude:</strong> {plane.altitude} ft</div>
                      <div><strong>Speed:</strong> {plane.speed} kts</div>
                      <div><strong>Heading:</strong> {plane.heading}°</div>
                      <div><strong>Status:</strong> {plane.status}</div>
                      <div><strong>Origin:</strong> {plane.origin}</div>
                      <div><strong>Destination:</strong> {plane.destination}</div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                        Updated: {plane.lastUpdated}
                      </div>
                    </div>
                  </Popup>
                  <Tooltip>
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{plane.callsign}</div>
                      <div>{plane.altitude} ft</div>
                      <div>{plane.status}</div>
                    </div>
                  </Tooltip>
                </Marker>

                {/* Aircraft Trail */}
                {plane.trail && plane.trail.length > 1 && (
                  <Polyline
                    positions={plane.trail}
                    pathOptions={{
                      color: color,
                      weight: 2,
                      opacity: 0.6,
                      dashArray: '5, 5'
                    }}
                  />
                )}

                {/* Next Waypoint Line */}
                {plane.nextWaypoint && (
                  <Polyline
                    positions={[[plane.lat, plane.lon], plane.nextWaypoint]}
                    pathOptions={{
                      color: color,
                      weight: 2,
                      opacity: 0.4,
                      dashArray: '10, 10'
                    }}
                  />
                )}

                {/* Next Waypoint Marker */}
                {plane.nextWaypoint && (
                  <CircleMarker
                    center={plane.nextWaypoint}
                    radius={4}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.7,
                      weight: 1
                    }}
                  >
                    <Tooltip>
                      <div style={{ fontSize: '11px' }}>
                        Next waypoint for {plane.callsign}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default ATCMap; 