import { CreateNewGoalData, CreateNewGoalVariables, GetMyGoalsData, UpdateGoalData, UpdateGoalVariables, DeleteGoalData, DeleteGoalVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateNewGoal(options?: useDataConnectMutationOptions<CreateNewGoalData, FirebaseError, CreateNewGoalVariables>): UseDataConnectMutationResult<CreateNewGoalData, CreateNewGoalVariables>;
export function useCreateNewGoal(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewGoalData, FirebaseError, CreateNewGoalVariables>): UseDataConnectMutationResult<CreateNewGoalData, CreateNewGoalVariables>;

export function useGetMyGoals(options?: useDataConnectQueryOptions<GetMyGoalsData>): UseDataConnectQueryResult<GetMyGoalsData, undefined>;
export function useGetMyGoals(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyGoalsData>): UseDataConnectQueryResult<GetMyGoalsData, undefined>;

export function useUpdateGoal(options?: useDataConnectMutationOptions<UpdateGoalData, FirebaseError, UpdateGoalVariables>): UseDataConnectMutationResult<UpdateGoalData, UpdateGoalVariables>;
export function useUpdateGoal(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateGoalData, FirebaseError, UpdateGoalVariables>): UseDataConnectMutationResult<UpdateGoalData, UpdateGoalVariables>;

export function useDeleteGoal(options?: useDataConnectMutationOptions<DeleteGoalData, FirebaseError, DeleteGoalVariables>): UseDataConnectMutationResult<DeleteGoalData, DeleteGoalVariables>;
export function useDeleteGoal(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteGoalData, FirebaseError, DeleteGoalVariables>): UseDataConnectMutationResult<DeleteGoalData, DeleteGoalVariables>;
