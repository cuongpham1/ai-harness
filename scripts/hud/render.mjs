import { getContextElement } from './elements/context.mjs';
import { getModelElement } from './elements/model.mjs';
import { getGitElement } from './elements/git.mjs';
import { getTaskElement } from './elements/task.mjs';
import { getSessionElement } from './elements/session.mjs';
import { getQuotaElement } from './elements/quota.mjs';
import { getAgentsElement } from './elements/agents.mjs';

export async function renderStatusLine(inputJson, config, state) {
  const elements = [];
  
  if (config.elements.context) {
    const context = await getContextElement(inputJson, config);
    if (context) elements.push(context);
  }
  
  if (config.elements.model) {
    const model = await getModelElement(inputJson, config);
    if (model) elements.push(model);
  }
  
  if (config.elements.quota) {
    const quota = await getQuotaElement(inputJson, config, state);
    if (quota) elements.push(quota);
  }
  
  if (config.elements.agents) {
    const agents = await getAgentsElement(inputJson, config, state);
    if (agents) elements.push(agents);
  }
  
  if (config.elements.git) {
    const git = await getGitElement(inputJson, config);
    if (git) elements.push(git);
  }
  
  if (config.elements.task) {
    const task = await getTaskElement(inputJson, config);
    if (task) elements.push(task);
  }
  
  if (config.elements.session) {
    const session = await getSessionElement(inputJson, config, state);
    if (session) elements.push(session);
  }
  
  if (config.elements.cwd) {
    const cwd = getCwdElement(inputJson, config);
    if (cwd) elements.push(cwd);
  }
  
  return elements.join(config.separator);
}

function getCwdElement(inputJson, config) {
  const cwd = inputJson.workspace?.current_dir || inputJson.cwd || '';
  if (!cwd) return null;
  
  // Show just the basename of the current directory
  const dirName = cwd.split('/').pop() || cwd.split('\\').pop() || cwd;
  return `${config.colors.reset}${dirName}${config.colors.reset}`;
}