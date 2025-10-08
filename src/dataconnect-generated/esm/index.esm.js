import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'default-2',
  service: 'copper-goals-tracker',
  location: 'us-west1'
};

export const createNewGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewGoal', inputVars);
}
createNewGoalRef.operationName = 'CreateNewGoal';

export function createNewGoal(dcOrVars, vars) {
  return executeMutation(createNewGoalRef(dcOrVars, vars));
}

export const getMyGoalsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyGoals');
}
getMyGoalsRef.operationName = 'GetMyGoals';

export function getMyGoals(dc) {
  return executeQuery(getMyGoalsRef(dc));
}

export const updateGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateGoal', inputVars);
}
updateGoalRef.operationName = 'UpdateGoal';

export function updateGoal(dcOrVars, vars) {
  return executeMutation(updateGoalRef(dcOrVars, vars));
}

export const deleteGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteGoal', inputVars);
}
deleteGoalRef.operationName = 'DeleteGoal';

export function deleteGoal(dcOrVars, vars) {
  return executeMutation(deleteGoalRef(dcOrVars, vars));
}

