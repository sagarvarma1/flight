import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LiveTranscription from '../components/LiveTranscription';
import ConflictAlerts from '../components/ConflictAlerts';
import ControllerScore from '../components/ControllerScore';
import ATCMap from '../components/ATCMap';
import Search from '../components/Search';
import transcriptData from '../transcript.json';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Global playback state that runs continuously
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const timeoutRef = useRef(null);

  // Shared conflict state
  const [currentConflicts, setCurrentConflicts] = useState([]);
  const [messageConflicts, setMessageConflicts] = useState(new Map());

  // Convert time string to seconds for comparison
  const timeToSeconds = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Parse ATC message to extract relevant data (shared logic)
  const parseMessage = (msg) => {
    const text = msg.message.toLowerCase();
    const data = {
      timestamp: msg.timestamp,
      callsign: msg.callsign,
      originalMessage: msg.message,
      timestampSeconds: timeToSeconds(msg.timestamp),
      actions: []
    };

    // Extract runway information
    const runwayMatch = text.match(/runway\s+(\w+)/i);
    if (runwayMatch) {
      data.runway = runwayMatch[1].toUpperCase();
    }

    // Extract action
    if (text.includes('cleared to land')) {
      data.action = 'land';
    } else if (text.includes('cleared for takeoff')) {
      data.action = 'takeoff';
    } else if (text.match(/climb and maintain|descend and maintain/)) {
      data.action = 'altitude_change';
      const altMatch = text.match(/(\d{4,5})/);
      if (altMatch) {
        data.altitude = parseInt(altMatch[1]);
      }
    } else if (text.includes('turn')) {
      data.action = 'heading_change';
    }

    // Extract altitude for altitude conflicts
    const altitudeMatch = text.match(/maintain\s+(\d{4,5})/);
    if (altitudeMatch) {
      data.altitude = parseInt(altitudeMatch[1]);
    }

    return data;
  };

  // Centralized conflict detection logic
  const detectConflicts = (currentMessage, previousMessages, existingConflicts) => {
    const newConflicts = [];
    const currentTime = currentMessage.timestampSeconds;

    // Generate unique conflict key for deduplication
    const getConflictKey = (conflict) => {
      switch (conflict.type) {
        case 'runway_conflict':
          return `runway_${conflict.runway}_${conflict.action}_${conflict.callsigns.sort().join('_')}`;
        case 'altitude_conflict':
          return `altitude_${conflict.altitude}_${conflict.callsigns.sort().join('_')}`;
        case 'duplicate_clearance':
          return `duplicate_${conflict.callsign}_${conflict.runway}_${conflict.action}`;
        case 'high_workload':
          return `frequency_${conflict.callsign}_${Math.floor(conflict.timestampSeconds / 60)}`;
        default:
          return `${conflict.type}_${Date.now()}`;
      }
    };

    // RED - Immediate Safety Threats
    
    // Red Rule 1: Two different aircraft cleared to land/takeoff on same runway within short time
    if (currentMessage.runway && currentMessage.action && (currentMessage.action === 'land' || currentMessage.action === 'takeoff')) {
      const recentMessages = previousMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 30 &&
        msg.runway === currentMessage.runway &&
        msg.action === currentMessage.action &&
        msg.callsign !== currentMessage.callsign
      );

      recentMessages.forEach(msg => {
        const timeDiff = currentTime - msg.timestampSeconds;
        const conflict = {
          id: `runway_critical_${Date.now()}_${Math.random()}`,
          type: 'runway_conflict',
          severity: 'CRITICAL',
          callsigns: [msg.callsign, currentMessage.callsign],
          runway: currentMessage.runway,
          action: `cleared to ${currentMessage.action}`,
          timestamps: [msg.timestamp, currentMessage.timestamp],
          time_difference_seconds: timeDiff,
          timestampSeconds: currentTime,
          detectedAt: currentTime,
          description: `IMMEDIATE SAFETY THREAT: ${msg.callsign} and ${currentMessage.callsign} both cleared to ${currentMessage.action} runway ${currentMessage.runway} within ${timeDiff}s - potential runway collision`
        };

        const conflictKey = getConflictKey(conflict);
        const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
        
        if (!isDuplicate) {
          newConflicts.push(conflict);
        }
      });
    }

    // Red Rule 3: Two aircraft assigned same altitude within seconds
    if (currentMessage.altitude && currentMessage.action === 'altitude_change') {
      const altitudeConflicts = previousMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 10 &&
        msg.altitude === currentMessage.altitude &&
        msg.callsign !== currentMessage.callsign &&
        msg.action === 'altitude_change'
      );

      altitudeConflicts.forEach(msg => {
        const timeDiff = currentTime - msg.timestampSeconds;
        const conflict = {
          id: `altitude_critical_${Date.now()}_${Math.random()}`,
          type: 'altitude_conflict',
          severity: 'CRITICAL',
          callsigns: [msg.callsign, currentMessage.callsign],
          altitude: currentMessage.altitude,
          time_difference_seconds: timeDiff,
          timestampSeconds: currentTime,
          detectedAt: currentTime,
          description: `IMMEDIATE SAFETY THREAT: ${msg.callsign} and ${currentMessage.callsign} both assigned ${currentMessage.altitude} feet within ${timeDiff}s - potential mid-air collision`
        };

        const conflictKey = getConflictKey(conflict);
        const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
        
        if (!isDuplicate) {
          newConflicts.push(conflict);
        }
      });
    }

    // YELLOW - Potential Conflicts

    // Yellow Rule 1: Two aircraft cleared to same runway within longer window
    if (currentMessage.runway && currentMessage.action && (currentMessage.action === 'land' || currentMessage.action === 'takeoff')) {
      const longerWindowMessages = previousMessages.filter(msg => 
        currentTime - msg.timestampSeconds > 30 &&
        currentTime - msg.timestampSeconds <= 90 &&
        msg.runway === currentMessage.runway &&
        msg.action === currentMessage.action &&
        msg.callsign !== currentMessage.callsign
      );

      longerWindowMessages.forEach(msg => {
        const timeDiff = currentTime - msg.timestampSeconds;
        const conflict = {
          id: `runway_warning_${Date.now()}_${Math.random()}`,
          type: 'runway_potential',
          severity: 'WARNING',
          callsigns: [msg.callsign, currentMessage.callsign],
          runway: currentMessage.runway,
          action: `cleared to ${currentMessage.action}`,
          time_difference_seconds: timeDiff,
          timestampSeconds: currentTime,
          detectedAt: currentTime,
          description: `Potential conflict: ${msg.callsign} and ${currentMessage.callsign} both cleared to ${currentMessage.action} runway ${currentMessage.runway} - monitor separation`
        };

        const conflictKey = getConflictKey(conflict);
        const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
        
        if (!isDuplicate) {
          newConflicts.push(conflict);
        }
      });
    }

    // Yellow Rule 2: Same aircraft receives same clearance more than once
    if (currentMessage.runway && currentMessage.action) {
      const duplicates = previousMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 60 &&
        msg.callsign === currentMessage.callsign &&
        msg.runway === currentMessage.runway &&
        msg.action === currentMessage.action
      );

      if (duplicates.length > 0) {
        const timeDiff = currentTime - duplicates[duplicates.length - 1].timestampSeconds;
        const conflict = {
          id: `duplicate_warning_${Date.now()}_${Math.random()}`,
          type: 'duplicate_clearance',
          severity: 'CRITICAL',
          callsign: currentMessage.callsign,
          runway: currentMessage.runway,
          action: currentMessage.action,
          time_difference_seconds: timeDiff,
          timestampSeconds: currentTime,
          detectedAt: currentTime,
          description: `Duplicate clearance: ${currentMessage.callsign} received duplicate clearance to ${currentMessage.action} runway ${currentMessage.runway}`
        };

        const conflictKey = getConflictKey(conflict);
        const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
        
        if (!isDuplicate) {
          newConflicts.push(conflict);
        }
      }
    }

    // Yellow Rule 4: Two aircraft assigned same altitude within one minute
    if (currentMessage.altitude && currentMessage.action === 'altitude_change') {
      const altitudeConflicts = previousMessages.filter(msg => 
        currentTime - msg.timestampSeconds > 10 &&
        currentTime - msg.timestampSeconds <= 60 &&
        msg.altitude === currentMessage.altitude &&
        msg.callsign !== currentMessage.callsign &&
        msg.action === 'altitude_change'
      );

      altitudeConflicts.forEach(msg => {
        const timeDiff = currentTime - msg.timestampSeconds;
        const conflict = {
          id: `altitude_warning_${Date.now()}_${Math.random()}`,
          type: 'altitude_potential',
          severity: 'WARNING',
          callsigns: [msg.callsign, currentMessage.callsign],
          altitude: currentMessage.altitude,
          time_difference_seconds: timeDiff,
          timestampSeconds: currentTime,
          detectedAt: currentTime,
          description: `Potential conflict: ${msg.callsign} and ${currentMessage.callsign} both assigned ${currentMessage.altitude} feet - verify separation`
        };

        const conflictKey = getConflictKey(conflict);
        const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
        
        if (!isDuplicate) {
          newConflicts.push(conflict);
        }
      });
    }

    // GRAY - Informational Patterns

    // Gray Rule 1: Single aircraft receives multiple instructions in short window
    const recentCallsignMessages = previousMessages.filter(msg => 
      currentTime - msg.timestampSeconds <= 60 &&
      msg.callsign === currentMessage.callsign
    );

    if (recentCallsignMessages.length >= 2) {
      const conflict = {
        id: `workload_info_${Date.now()}_${Math.random()}`,
        type: 'high_workload',
        severity: 'INFO',
        callsign: currentMessage.callsign,
        message_count: recentCallsignMessages.length + 1,
        timestampSeconds: currentTime,
        detectedAt: currentTime,
        description: `High workload pattern: ${currentMessage.callsign} received ${recentCallsignMessages.length + 1} instructions in 60 seconds`
      };

      const conflictKey = getConflictKey(conflict);
      const isDuplicate = existingConflicts.some(existing => getConflictKey(existing) === conflictKey);
      
      if (!isDuplicate) {
        newConflicts.push(conflict);
      }
    }

    return newConflicts;
  };

  // Global timeline manager that runs continuously
  useEffect(() => {
    if (!isPlaying || currentPlaybackIndex >= transcriptData.length) {
      if (currentPlaybackIndex >= transcriptData.length) {
        // Reset when reached the end
        setCurrentPlaybackIndex(0);
        setCurrentTimestamp(null);
        setCurrentConflicts([]);
        setMessageConflicts(new Map());
      }
      return;
    }

    const scheduleNextMessage = () => {
      const currentMessage = transcriptData[currentPlaybackIndex];
      setCurrentTimestamp(currentMessage.timestamp);

      // Update conflicts when new message appears
      const messagesToProcess = transcriptData.slice(0, currentPlaybackIndex + 1);
      const allParsedMessages = messagesToProcess.map(parseMessage);
      
      // Detect conflicts in real-time
      const allConflicts = [];
      const conflictMap = new Map();
      
      allParsedMessages.forEach((currentMsg, index) => {
        const previousMessages = allParsedMessages.slice(0, index);
        const newConflicts = detectConflicts(currentMsg, previousMessages, allConflicts);
        
        newConflicts.forEach(conflict => {
          allConflicts.push(conflict);
          
          // Mark the current message that caused the conflict
          const currentKey = `${currentMsg.timestamp}-${currentMsg.callsign}`;
          const severity = conflict.severity;
          conflictMap.set(currentKey, severity);
          
          // Mark any previous messages involved in this conflict
          if (conflict.callsigns && conflict.callsigns.length > 1) {
            conflict.callsigns.forEach(callsign => {
              if (callsign !== currentMsg.callsign) {
                // Find the previous message for this callsign involved in the conflict
                const prevMsg = previousMessages.find(msg => 
                  msg.callsign === callsign && 
                  Math.abs(currentMsg.timestampSeconds - msg.timestampSeconds) <= 90
                );
                if (prevMsg) {
                  const prevKey = `${prevMsg.timestamp}-${prevMsg.callsign}`;
                  conflictMap.set(prevKey, severity);
                }
              }
            });
          }
        });
      });

      // Keep only recent conflicts (last 5 minutes)
      const currentTime = timeToSeconds(currentMessage.timestamp);
      const cutoffTime = currentTime - 300;
      const filteredConflicts = allConflicts.filter(conflict => 
        (conflict.detectedAt || conflict.timestampSeconds) >= cutoffTime
      );

      setCurrentConflicts(filteredConflicts);
      setMessageConflicts(conflictMap);

      // Calculate real-time delay until next message
      let delay = 2000; // Default 2 seconds if no next message
      
      if (currentPlaybackIndex + 1 < transcriptData.length) {
        const nextMessage = transcriptData[currentPlaybackIndex + 1];
        const currentTime = timeToSeconds(currentMessage.timestamp);
        const nextTime = timeToSeconds(nextMessage.timestamp);
        const realTimeDiff = nextTime - currentTime;
        
        // Use actual real-time delays (1 second = 1000ms)
        delay = realTimeDiff * 1000;
        
        // Set reasonable bounds for demo
        delay = Math.max(delay, 500); // Minimum 500ms between messages
        delay = Math.min(delay, 30000); // Maximum 30 seconds for very long gaps
      }

      // Schedule next message advancement
      timeoutRef.current = setTimeout(() => {
        setCurrentPlaybackIndex(prev => prev + 1);
      }, delay);
    };

    scheduleNextMessage();

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentPlaybackIndex, isPlaying]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleSearchClick = () => {
    setCurrentView('search');
    // Timeline continues running in background - no pause
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    // Components will sync to current playback position automatically
  };

  if (currentView === 'search') {
    return (
      <Search 
        onBack={handleBackToDashboard} 
        currentPlaybackIndex={currentPlaybackIndex}
        currentTimestamp={currentTimestamp}
      />
    );
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-content">
          <div>
            <h1 className="navbar-title">Yeager ATC</h1>
          </div>
          <div className="navbar-user">
            <button onClick={handleSearchClick} className="btn-pill" style={{ marginRight: '1rem' }}>
              Search
            </button>
            <button onClick={handleLogout} className="btn-pill">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 0',
          borderBottom: '1px solid #000000',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              fontSize: '1.1rem',
              color: '#000000',
              marginBottom: '0.5rem'
            }}>
              Welcome, {user?.email}
            </div>
            <div style={{
              fontSize: '1.1rem',
              color: '#000000',
              marginBottom: '1rem'
            }}>
              Your Airport: San Francisco International (SFO)
            </div>
          </div>
          <ControllerScore 
            currentPlaybackIndex={currentPlaybackIndex}
            currentTimestamp={currentTimestamp}
            conflicts={currentConflicts}
          />
        </div>

        {/* Severity Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2rem',
          marginBottom: '2rem',
          padding: '1rem'
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#000000' }}>
            Alert Levels:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#dc2626'
            }}></div>
            <span style={{ color: '#000000', fontWeight: '500' }}>Critical</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#f59e0b'
            }}></div>
            <span style={{ color: '#000000', fontWeight: '500' }}>Warning</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#3b82f6'
            }}></div>
            <span style={{ color: '#000000', fontWeight: '500' }}>Info</span>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          <LiveTranscription 
            currentPlaybackIndex={currentPlaybackIndex}
            currentTimestamp={currentTimestamp}
            messageConflicts={messageConflicts}
          />
          <ConflictAlerts 
            currentPlaybackIndex={currentPlaybackIndex}
            currentTimestamp={currentTimestamp}
            conflicts={currentConflicts}
          />
        </div>

        {/* ATC Map */}
        <ATCMap 
          currentPlaybackIndex={currentPlaybackIndex}
          messageConflicts={messageConflicts}
        />

        {/* Footer */}
        <footer style={{
          marginTop: '4rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e5e5',
          padding: '2rem 0'
        }}>
          {/* Demo Message */}
          <div style={{
            textAlign: 'center',
            padding: '2rem 0'
          }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#000000',
              letterSpacing: '0.1rem',
              fontFamily: 'Arial, sans-serif',
              lineHeight: '1.3',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              This demo was made by Sagar Varma for consideration for employment at the Enhanced Radar Co. of San Francisco. It has not been approved by the team at the Co. in any way and is not a product offering from them.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard; 