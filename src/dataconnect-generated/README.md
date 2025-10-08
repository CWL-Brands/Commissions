# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default-2`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyGoals*](#getmygoals)
- [**Mutations**](#mutations)
  - [*CreateNewGoal*](#createnewgoal)
  - [*UpdateGoal*](#updategoal)
  - [*DeleteGoal*](#deletegoal)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default-2`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default-2` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyGoals
You can execute the `GetMyGoals` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyGoals(): QueryPromise<GetMyGoalsData, undefined>;

interface GetMyGoalsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyGoalsData, undefined>;
}
export const getMyGoalsRef: GetMyGoalsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyGoals(dc: DataConnect): QueryPromise<GetMyGoalsData, undefined>;

interface GetMyGoalsRef {
  ...
  (dc: DataConnect): QueryRef<GetMyGoalsData, undefined>;
}
export const getMyGoalsRef: GetMyGoalsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyGoalsRef:
```typescript
const name = getMyGoalsRef.operationName;
console.log(name);
```

### Variables
The `GetMyGoals` query has no variables.
### Return Type
Recall that executing the `GetMyGoals` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyGoalsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetMyGoals`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyGoals } from '@dataconnect/generated';


// Call the `getMyGoals()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyGoals();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyGoals(dataConnect);

console.log(data.goals);

// Or, you can use the `Promise` API.
getMyGoals().then((response) => {
  const data = response.data;
  console.log(data.goals);
});
```

### Using `GetMyGoals`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyGoalsRef } from '@dataconnect/generated';


// Call the `getMyGoalsRef()` function to get a reference to the query.
const ref = getMyGoalsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyGoalsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.goals);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.goals);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default-2` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateNewGoal
You can execute the `CreateNewGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNewGoal(vars: CreateNewGoalVariables): MutationPromise<CreateNewGoalData, CreateNewGoalVariables>;

interface CreateNewGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewGoalVariables): MutationRef<CreateNewGoalData, CreateNewGoalVariables>;
}
export const createNewGoalRef: CreateNewGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNewGoal(dc: DataConnect, vars: CreateNewGoalVariables): MutationPromise<CreateNewGoalData, CreateNewGoalVariables>;

interface CreateNewGoalRef {
  ...
  (dc: DataConnect, vars: CreateNewGoalVariables): MutationRef<CreateNewGoalData, CreateNewGoalVariables>;
}
export const createNewGoalRef: CreateNewGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNewGoalRef:
```typescript
const name = createNewGoalRef.operationName;
console.log(name);
```

### Variables
The `CreateNewGoal` mutation requires an argument of type `CreateNewGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateNewGoalVariables {
  name: string;
  description: string;
  targetValue: number;
  deadline: TimestampString;
  type: string;
  status: string;
}
```
### Return Type
Recall that executing the `CreateNewGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNewGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNewGoalData {
  goal_insert: Goal_Key;
}
```
### Using `CreateNewGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNewGoal, CreateNewGoalVariables } from '@dataconnect/generated';

// The `CreateNewGoal` mutation requires an argument of type `CreateNewGoalVariables`:
const createNewGoalVars: CreateNewGoalVariables = {
  name: ..., 
  description: ..., 
  targetValue: ..., 
  deadline: ..., 
  type: ..., 
  status: ..., 
};

// Call the `createNewGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNewGoal(createNewGoalVars);
// Variables can be defined inline as well.
const { data } = await createNewGoal({ name: ..., description: ..., targetValue: ..., deadline: ..., type: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNewGoal(dataConnect, createNewGoalVars);

console.log(data.goal_insert);

// Or, you can use the `Promise` API.
createNewGoal(createNewGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_insert);
});
```

### Using `CreateNewGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNewGoalRef, CreateNewGoalVariables } from '@dataconnect/generated';

// The `CreateNewGoal` mutation requires an argument of type `CreateNewGoalVariables`:
const createNewGoalVars: CreateNewGoalVariables = {
  name: ..., 
  description: ..., 
  targetValue: ..., 
  deadline: ..., 
  type: ..., 
  status: ..., 
};

// Call the `createNewGoalRef()` function to get a reference to the mutation.
const ref = createNewGoalRef(createNewGoalVars);
// Variables can be defined inline as well.
const ref = createNewGoalRef({ name: ..., description: ..., targetValue: ..., deadline: ..., type: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNewGoalRef(dataConnect, createNewGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_insert);
});
```

## UpdateGoal
You can execute the `UpdateGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateGoal(vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface UpdateGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
}
export const updateGoalRef: UpdateGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGoal(dc: DataConnect, vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface UpdateGoalRef {
  ...
  (dc: DataConnect, vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
}
export const updateGoalRef: UpdateGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGoalRef:
```typescript
const name = updateGoalRef.operationName;
console.log(name);
```

### Variables
The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `UpdateGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGoalData {
  goal_update?: Goal_Key | null;
}
```
### Using `UpdateGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGoal, UpdateGoalVariables } from '@dataconnect/generated';

// The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`:
const updateGoalVars: UpdateGoalVariables = {
  id: ..., 
  name: ..., // optional
  description: ..., // optional
  targetValue: ..., // optional
  deadline: ..., // optional
  type: ..., // optional
  status: ..., // optional
  priority: ..., // optional
  category: ..., // optional
};

// Call the `updateGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGoal(updateGoalVars);
// Variables can be defined inline as well.
const { data } = await updateGoal({ id: ..., name: ..., description: ..., targetValue: ..., deadline: ..., type: ..., status: ..., priority: ..., category: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGoal(dataConnect, updateGoalVars);

console.log(data.goal_update);

// Or, you can use the `Promise` API.
updateGoal(updateGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_update);
});
```

### Using `UpdateGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGoalRef, UpdateGoalVariables } from '@dataconnect/generated';

// The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`:
const updateGoalVars: UpdateGoalVariables = {
  id: ..., 
  name: ..., // optional
  description: ..., // optional
  targetValue: ..., // optional
  deadline: ..., // optional
  type: ..., // optional
  status: ..., // optional
  priority: ..., // optional
  category: ..., // optional
};

// Call the `updateGoalRef()` function to get a reference to the mutation.
const ref = updateGoalRef(updateGoalVars);
// Variables can be defined inline as well.
const ref = updateGoalRef({ id: ..., name: ..., description: ..., targetValue: ..., deadline: ..., type: ..., status: ..., priority: ..., category: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGoalRef(dataConnect, updateGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_update);
});
```

## DeleteGoal
You can execute the `DeleteGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteGoal(vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

interface DeleteGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
}
export const deleteGoalRef: DeleteGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteGoal(dc: DataConnect, vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

interface DeleteGoalRef {
  ...
  (dc: DataConnect, vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
}
export const deleteGoalRef: DeleteGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteGoalRef:
```typescript
const name = deleteGoalRef.operationName;
console.log(name);
```

### Variables
The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteGoalVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteGoalData {
  goal_delete?: Goal_Key | null;
}
```
### Using `DeleteGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteGoal, DeleteGoalVariables } from '@dataconnect/generated';

// The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`:
const deleteGoalVars: DeleteGoalVariables = {
  id: ..., 
};

// Call the `deleteGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteGoal(deleteGoalVars);
// Variables can be defined inline as well.
const { data } = await deleteGoal({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteGoal(dataConnect, deleteGoalVars);

console.log(data.goal_delete);

// Or, you can use the `Promise` API.
deleteGoal(deleteGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_delete);
});
```

### Using `DeleteGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteGoalRef, DeleteGoalVariables } from '@dataconnect/generated';

// The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`:
const deleteGoalVars: DeleteGoalVariables = {
  id: ..., 
};

// Call the `deleteGoalRef()` function to get a reference to the mutation.
const ref = deleteGoalRef(deleteGoalVars);
// Variables can be defined inline as well.
const ref = deleteGoalRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteGoalRef(dataConnect, deleteGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_delete);
});
```

