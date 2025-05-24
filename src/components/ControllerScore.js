import React, { useState, useEffect } from 'react';
import transcriptData from '../transcript.json';

const ControllerScore = ({ currentPlaybackIndex, currentTimestamp }) => {
  const [score, setScore] = useState(0);
  const [processedMessages, setProcessedMessages] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  // Convert time string to seconds for comparison
  const timeToSeconds = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Parse ATC message to extract relevant data
  const parseMessage = (msg) => {
    const text = msg.message.toLowerCase();
    const data = {
      timestamp: msg.timestamp,
      callsign: msg.callsign,
      originalMessage: msg.message,
      timestampSeconds: timeToSeconds(msg.timestamp),
      isClearance: false
    };

    // Extract runway information
    const runwayMatch = text.match(/runway\s+(\w+)/i);
    if (runwayMatch) {
      data.runway = runwayMatch[1].toUpperCase();
    }

    // Check if message is a clearance
    if (text.includes('cleared to land') || 
        text.includes('cleared for takeoff') ||
        text.includes('climb and maintain') ||
        text.includes('descend and maintain') ||
        text.match(/turn (left|right) heading/)) {
      data.isClearance = true;
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

  // Check for conflicts (simplified version of the main conflict detection)
  const checkConflicts = (newMessage, allMessages) => {
    const newConflicts = [];
    const currentTime = newMessage.timestampSeconds;

    // RED - Immediate Safety Threats
    if (newMessage.runway && newMessage.action && (newMessage.action === 'land' || newMessage.action === 'takeoff')) {
      const recentMessages = allMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 30 &&
        msg.runway === newMessage.runway &&
        msg.action === newMessage.action &&
        msg.callsign !== newMessage.callsign
      );

      if (recentMessages.length > 0) {
        newConflicts.push({
          id: `runway_critical_${Date.now()}_${Math.random()}`,
          severity: 'CRITICAL',
          timestampSeconds: currentTime
        });
      }
    }

    if (newMessage.altitude && newMessage.action === 'altitude_change') {
      const altitudeConflicts = allMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 10 &&
        msg.altitude === newMessage.altitude &&
        msg.callsign !== newMessage.callsign &&
        msg.action === 'altitude_change'
      );

      if (altitudeConflicts.length > 0) {
        newConflicts.push({
          id: `altitude_critical_${Date.now()}_${Math.random()}`,
          severity: 'CRITICAL',
          timestampSeconds: currentTime
        });
      }
    }

    // YELLOW - Potential Conflicts
    if (newMessage.runway && newMessage.action && (newMessage.action === 'land' || newMessage.action === 'takeoff')) {
      const longerWindowMessages = allMessages.filter(msg => 
        currentTime - msg.timestampSeconds > 30 &&
        currentTime - msg.timestampSeconds <= 90 &&
        msg.runway === newMessage.runway &&
        msg.action === newMessage.action &&
        msg.callsign !== newMessage.callsign
      );

      if (longerWindowMessages.length > 0) {
        newConflicts.push({
          id: `runway_warning_${Date.now()}_${Math.random()}`,
          severity: 'WARNING',
          timestampSeconds: currentTime
        });
      }
    }

    return newConflicts;
  };

  // Calculate the controller score
  const calculateScore = (currentMessage, allMessages, allConflicts) => {
    const currentTime = currentMessage.timestampSeconds;

    // 1. Number of clearances in past 60 seconds
    const clearancesLast60s = allMessages.filter(msg => 
      currentTime - msg.timestampSeconds <= 60 && msg.isClearance
    ).length;

    // 2. Number of conflicts detected in past 60 seconds
    const conflictsLast60s = allConflicts.filter(conflict => 
      currentTime - conflict.timestampSeconds <= 60
    ).length;

    // 3. Number of aircraft currently under control (active in last 2 minutes)
    const uniqueAircraftLast2min = new Set(
      allMessages.filter(msg => 
        currentTime - msg.timestampSeconds <= 120
      ).map(msg => msg.callsign)
    ).size;

    // Apply formula: clearances + 2*conflicts + 0.5*aircraft
    const score = clearancesLast60s + (2 * conflictsLast60s) + (0.5 * uniqueAircraftLast2min);
    
    return Math.round(score * 10) / 10; // Round to 1 decimal place
  };

  // Get score level and color
  const getScoreLevel = (score) => {
    if (score < 10) return { level: 'NORMAL', color: '#6b7280' };
    if (score <= 20) return { level: 'ELEVATED', color: '#f59e0b' };
    return { level: 'HIGH', color: '#dc2626' };
  };

  // Sync to global playback position
  useEffect(() => {
    if (currentPlaybackIndex >= 0 && currentPlaybackIndex < transcriptData.length) {
      // Get all messages up to current playback position
      const messagesToProcess = transcriptData.slice(0, currentPlaybackIndex + 1);
      
      // Parse all messages
      const allParsedMessages = messagesToProcess.map(parseMessage);
      setProcessedMessages(allParsedMessages);

      // Calculate conflicts only when they actually happen
      const allConflicts = [];
      allParsedMessages.forEach((currentMessage, index) => {
        const previousMessages = allParsedMessages.slice(0, index);
        const newConflicts = checkConflicts(currentMessage, previousMessages);
        
        // Add timestamp when the conflict was detected
        newConflicts.forEach(conflict => {
          conflict.detectedAt = currentMessage.timestampSeconds;
        });
        
        allConflicts.push(...newConflicts);
      });

      // Keep only recent conflicts (last 5 minutes)
      const currentTime = timeToSeconds(transcriptData[currentPlaybackIndex].timestamp);
      const cutoffTime = currentTime - 300;
      const filteredConflicts = allConflicts.filter(conflict => 
        (conflict.detectedAt || conflict.timestampSeconds) >= cutoffTime
      );
      setConflicts(filteredConflicts);

      // Calculate score based on current position
      if (allParsedMessages.length > 0) {
        const currentMessage = allParsedMessages[allParsedMessages.length - 1];
        const newScore = calculateScore(currentMessage, allParsedMessages, filteredConflicts);
        setScore(newScore);
      }
    }
  }, [currentPlaybackIndex]);

  const { level, color } = getScoreLevel(score);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: '#000000'
      }}>
        Controller Load:
      </div>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: color
      }}>
        {level}
      </div>
      <div style={{
        fontSize: '1rem',
        color: '#666666',
        marginLeft: '1rem'
      }}>
        (Score: {score})
      </div>
    </div>
  );
};

export default ControllerScore; 