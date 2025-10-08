import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CRMEntityLink_Key {
  id: UUIDString;
  __typename?: 'CRMEntityLink_Key';
}

export interface Comment_Key {
  id: UUIDString;
  __typename?: 'Comment_Key';
}

export interface CreateNewGoalData {
  goal_insert: Goal_Key;
}

export interface CreateNewGoalVariables {
  name: string;
  description: string;
  targetValue: number;
  deadline: TimestampString;
  type: string;
  status: string;
}

export interface DeleteGoalData {
  goal_delete?: Goal_Key | null;
}

export interface DeleteGoalVariables {
  id: UUIDString;
}

export interface GetMyGoalsData {
  goals: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    targetValue: number;
    currentValue: number;
    deadline: TimestampString;
    type: string;
    status: string;
    priority?: string | null;
    category?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Goal_Key)[];
}

export interface GoalUpdate_Key {
  id: UUIDString;
  __typename?: 'GoalUpdate_Key';
}

export interface Goal_Key {
  id: UUIDString;
  __typename?: 'Goal_Key';
}

export interface UpdateGoalData {
  goal_update?: Goal_Key | null;
}

export interface UpdateGoalVariables {
  id: UUIDString;
  name?: string | null;
  description?: string | null;
  targetValue?: number | null;
  deadline?: TimestampString | null;
  type?: string | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateNewGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewGoalVariables): MutationRef<CreateNewGoalData, CreateNewGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNewGoalVariables): MutationRef<CreateNewGoalData, CreateNewGoalVariables>;
  operationName: string;
}
export const createNewGoalRef: CreateNewGoalRef;

export function createNewGoal(vars: CreateNewGoalVariables): MutationPromise<CreateNewGoalData, CreateNewGoalVariables>;
export function createNewGoal(dc: DataConnect, vars: CreateNewGoalVariables): MutationPromise<CreateNewGoalData, CreateNewGoalVariables>;

interface GetMyGoalsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyGoalsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyGoalsData, undefined>;
  operationName: string;
}
export const getMyGoalsRef: GetMyGoalsRef;

export function getMyGoals(): QueryPromise<GetMyGoalsData, undefined>;
export function getMyGoals(dc: DataConnect): QueryPromise<GetMyGoalsData, undefined>;

interface UpdateGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
  operationName: string;
}
export const updateGoalRef: UpdateGoalRef;

export function updateGoal(vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;
export function updateGoal(dc: DataConnect, vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface DeleteGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
  operationName: string;
}
export const deleteGoalRef: DeleteGoalRef;

export function deleteGoal(vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;
export function deleteGoal(dc: DataConnect, vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

