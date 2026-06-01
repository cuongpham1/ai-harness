export function loadConfig() {
  // Default configuration
  const defaultConfig = {
    preset: 'full', // 'minimal', 'focused', 'full'
    elements: {
      context: true,
      model: true,
      quota: true,
      agents: false,
      cwd: false, // Not shown by default to keep it clean
      git: true,
      task: true,
      session: true
    },
    separator: ' | ',
    colors: {
      context: '\x1b[36m', // Cyan
      model: '\x1b[33m', // Yellow
      quota: '\x1b[37m', // White
      agents: '\x1b[36m', // Cyan
      running: '\x1b[33m', // Yellow
      completed: '\x1b[32m', // Green
      spawned: '\x1b[35m', // Magenta
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      ok: '\x1b[32m', // Green
      git: '\x1b[32m', // Green
      task: '\x1b[35m', // Magenta
      session: '\x1b[37m', // White
      reset: '\x1b[0m'   // Reset
    }
  };

  // Load any custom configuration from environment or config file
  const preset = process.env.HUD_PRESET || defaultConfig.preset;

  return applyPreset(defaultConfig, preset);
}

function applyPreset(config, preset) {
  const presets = {
    minimal: {
      ...config,
      preset: 'minimal',
      elements: {
        ...config.elements,
        context: true,
        model: true,
        quota: false,
        agents: false,
        git: true,
        task: false,
        session: false,
        cwd: false
      }
    },
    focused: {
      ...config,
      preset: 'focused',
      elements: {
        ...config.elements,
        context: true,
        model: true,
        quota: true,
        agents: true,
        git: true,
        task: true,
        session: false,
        cwd: false
      }
    },
    full: {
      ...config,
      preset: 'full',
      elements: {
        ...config.elements,
        context: true,
        model: true,
        quota: true,
        agents: true,
        git: true,
        task: true,
        session: true,
        cwd: true
      }
    }
  };

  return presets[preset] || config;
}