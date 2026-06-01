/**
 * Quota/Rates Limits Element for HUD
 * Displays usage percentages from Anthropic OAuth API
 */

import { getQuotaDisplayData } from '../quota-api.mjs';

export async function getQuotaElement(inputJson, config, state) {
  // Try to get real quota data from API
  let quotaData = null;
  try {
    quotaData = await getQuotaDisplayData();
  } catch (error) {
    // Ignore errors, will fall back to inputJson
  }

  // Create synthetic usage_limits from real data if available
  let usageLimits = inputJson.usage_limits;
  if (quotaData) {
    usageLimits = {
      session: {
        current_usage_percentage: quotaData.session,
        reset_at: quotaData.resetAt
      },
      weekly: {
        all_models: {
          current_usage_percentage: quotaData.weekly
        },
        sonnet_only: {
          current_usage_percentage: quotaData.sonnet
        }
      }
    };
  }

  if (!usageLimits) {
    return "quota: --";
  }

  // Extract usage data
  const sessionCurrent = usageLimits.session?.current_usage_percentage;
  const weeklyAllModels = usageLimits.weekly?.all_models?.current_usage_percentage;
  const weeklySonnetOnly = usageLimits.weekly?.sonnet_only?.current_usage_percentage;
  const resetAt = usageLimits.session?.reset_at || usageLimits.session?.reset_in_hours || usageLimits.session?.reset_in_minutes;

  // Calculate status based on usage percentage
  const calculateStatus = (percentage) => {
    if (percentage === null || percentage === undefined) return null;
    if (percentage > 85) return 'critical';
    if (percentage >= 70) return 'warning';
    return 'ok';
  };

  // Get colors
  const color = config.colors.quota || config.colors.reset;
  const reset = config.colors.reset;
  const warningColor = config.colors.warning || '\x1b[33m'; // yellow
  const errorColor = config.colors.error || '\x1b[31m'; // red
  const okColor = config.colors.ok || '\x1b[32m'; // green

  // Format session usage (primary)
  let sessionText = '';
  if (typeof sessionCurrent === 'number') {
    const sessionStatus = calculateStatus(sessionCurrent);
    let sessionStatusIndicator = '';
    if (sessionStatus === 'ok') {
      sessionStatusIndicator = `${okColor}✓${reset}`;
    } else if (sessionStatus === 'warning') {
      sessionStatusIndicator = `${warningColor}⚠${reset}`;
    } else if (sessionStatus === 'critical') {
      sessionStatusIndicator = `${errorColor}!${reset}`;
    }
    sessionText = `${color}5h: ${Math.round(sessionCurrent)}%${reset}${sessionStatusIndicator ? ` ${sessionStatusIndicator}` : ''}`;
  }

  // Format weekly usage (secondary)
  let weeklyText = '';
  if (typeof weeklyAllModels === 'number') {
    const weeklyStatus = calculateStatus(weeklyAllModels);
    let weeklyStatusIndicator = '';
    if (weeklyStatus === 'ok') {
      weeklyStatusIndicator = `${okColor}✓${reset}`;
    } else if (weeklyStatus === 'warning') {
      weeklyStatusIndicator = `${warningColor}⚠${reset}`;
    } else if (weeklyStatus === 'critical') {
      weeklyStatusIndicator = `${errorColor}!${reset}`;
    }
    weeklyText = `${color}wk: ${Math.round(weeklyAllModels)}%${reset}${weeklyStatusIndicator ? ` ${weeklyStatusIndicator}` : ''}`;
  }

  // Format weekly Sonnet-only usage (tertiary)
  let sonnetText = '';
  if (typeof weeklySonnetOnly === 'number') {
    const sonnetStatus = calculateStatus(weeklySonnetOnly);
    let sonnetStatusIndicator = '';
    if (sonnetStatus === 'ok') {
      sonnetStatusIndicator = `${okColor}✓${reset}`;
    } else if (sonnetStatus === 'warning') {
      sonnetStatusIndicator = `${warningColor}⚠${reset}`;
    } else if (sonnetStatus === 'critical') {
      sonnetStatusIndicator = `${errorColor}!${reset}`;
    }
    sonnetText = `${color}sn: ${Math.round(weeklySonnetOnly)}%${reset}${sonnetStatusIndicator ? ` ${sonnetStatusIndicator}` : ''}`;
  }

  // Combine all texts
  const parts = [sessionText, weeklyText, sonnetText].filter(Boolean);
  if (parts.length === 0) return "quota: --";
  
  return parts.join(' ');
}