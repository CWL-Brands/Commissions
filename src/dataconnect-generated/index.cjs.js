const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default-2',
  service: 'copper-goals-tracker',
  location: 'us-west1'
};
exports.connectorConfig = connectorConfig;

const createNewGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewGoal', inputVars);
}
createNewGoalRef.operationName = 'CreateNewGoal';
exports.createNewGoalRef = createNewGoalRef;

exports.createNewGoal = function createNewGoal(dcOrVars, vars) {
  return executeMutation(createNewGoalRef(dcOrVars, vars));
};

const getMyGoalsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyGoals');
}
getMyGoalsRef.operationName = 'GetMyGoals';
exports.getMyGoalsRef = getMyGoalsRef;

exports.getMyGoals = function getMyGoals(dc) {
  return executeQuery(getMyGoalsRef(dc));
};

const updateGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateGoal', inputVars);
}
updateGoalRef.operationName = 'UpdateGoal';
exports.updateGoalRef = updateGoalRef;

exports.updateGoal = function updateGoal(dcOrVars, vars) {
  return executeMutation(updateGoalRef(dcOrVars, vars));
};

const deleteGoalRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteGoal', inputVars);
}
deleteGoalRef.operationName = 'DeleteGoal';
exports.deleteGoalRef = deleteGoalRef;

exports.deleteGoal = function deleteGoal(dcOrVars, vars) {
  return executeMutation(deleteGoalRef(dcOrVars, vars));
};
