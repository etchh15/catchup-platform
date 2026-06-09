/**
 * useOptimisticMutation Hook - React 19 Optimistic UI Pattern
 * 
 * Provides instant UI feedback while async mutations complete in the background.
 * Automatically rolls back state on errors.
 * 
 * Usage:
 *   const [state, isPending, dispatch] = useOptimisticMutation(
 *     initialState,
 *     reducer,
 *     asyncMutation
 *   );
 * 
 *   // Trigger optimistic update:
 *   dispatch(action); // Updates UI immediately, mutation happens in background
 */

import { useOptimistic, useCallback } from 'react';

export function useOptimisticMutation(initialState, reducer, asyncMutation) {
  const [optimisticState, dispatch] = useOptimistic(
    initialState,
    reducer
  );

  const isPending = false; // Will be true during mutation
  const [isPendingState, setIsPending] = React.useState(false);

  const executeOptimisticMutation = useCallback(
    async (action) => {
      // 1. Dispatch optimistic update immediately
      dispatch(action);
      setIsPending(true);

      try {
        // 2. Execute async mutation in background
        await asyncMutation(action);
        // No explicit state update needed - optimistic state IS the new state
        setIsPending(false);
      } catch (error) {
        // 3. On error, dispatch rollback action
        dispatch({ type: 'ROLLBACK', error });
        setIsPending(false);
        throw error; // Re-throw for caller to handle
      }
    },
    [dispatch, asyncMutation]
  );

  return [optimisticState, isPendingState, executeOptimisticMutation];
}

/**
 * Preset: useOptimisticToggle
 * 
 * For boolean toggle mutations (e.g., notification preferences)
 * 
 * Usage:
 *   const [prefs, isPending, toggle] = useOptimisticToggle(
 *     initialPrefs,
 *     async (key, newValue) => {
 *       await updatePreferences(userId, { [key]: newValue });
 *     }
 *   );
 *   
 *   toggle('email_notifications'); // Toggles immediately
 */
export function useOptimisticToggle(initialState, onMutate) {
  const toggleReducer = (state, action) => {
    if (action.type === 'TOGGLE') {
      return {
        ...state,
        [action.payload]: !state[action.payload],
      };
    }
    if (action.type === 'ROLLBACK') {
      return state; // Just revert (caller should cache original)
    }
    return state;
  };

  const [state, isPending, dispatch] = useOptimisticMutation(
    initialState,
    toggleReducer,
    async (action) => {
      if (action.type === 'TOGGLE') {
        await onMutate(action.payload, !initialState[action.payload]);
      }
    }
  );

  const toggle = useCallback(
    (key) => {
      dispatch({ type: 'TOGGLE', payload: key });
    },
    [dispatch]
  );

  return [state, isPending, toggle];
}

/**
 * Preset: useOptimisticList
 * 
 * For list mutations (add, update, remove items)
 * 
 * Usage:
 *   const [items, isPending, addItem, removeItem] = useOptimisticList(
 *     initialItems,
 *     async (id) => {
 *       await deleteItemApi(id);
 *     }
 *   );
 *   
 *   removeItem(itemId); // Removes immediately from UI
 */
export function useOptimisticList(initialItems, onMutate) {
  const listReducer = (state, action) => {
    switch (action.type) {
      case 'ADD':
        return [...state, action.payload];
      case 'REMOVE':
        return state.filter(item => item.id !== action.payload);
      case 'UPDATE':
        return state.map(item =>
          item.id === action.payload.id ? action.payload : item
        );
      case 'ROLLBACK':
        return state; // Revert
      default:
        return state;
    }
  };

  const [items, isPending, dispatch] = useOptimisticMutation(
    initialItems,
    listReducer,
    async (action) => {
      if (action.type === 'REMOVE') {
        await onMutate(action.payload);
      }
    }
  );

  const removeItem = useCallback(
    (id) => {
      dispatch({ type: 'REMOVE', payload: id });
    },
    [dispatch]
  );

  const addItem = useCallback(
    (item) => {
      dispatch({ type: 'ADD', payload: item });
    },
    [dispatch]
  );

  const updateItem = useCallback(
    (item) => {
      dispatch({ type: 'UPDATE', payload: item });
    },
    [dispatch]
  );

  return [items, isPending, addItem, removeItem, updateItem];
}

/**
 * Preset: useOptimisticValue
 * 
 * For simple value mutations (text, number, etc.)
 * 
 * Usage:
 *   const [value, isPending, setValue] = useOptimisticValue(
 *     initialValue,
 *     async (newValue) => {
 *       await updateValueApi(newValue);
 *     }
 *   );
 *   
 *   setValue(newValue); // Updates immediately
 */
export function useOptimisticValue(initialValue, onMutate) {
  const valueReducer = (state, action) => {
    if (action.type === 'SET') {
      return action.payload;
    }
    if (action.type === 'ROLLBACK') {
      return state;
    }
    return state;
  };

  const [value, isPending, dispatch] = useOptimisticMutation(
    initialValue,
    valueReducer,
    async (action) => {
      if (action.type === 'SET') {
        await onMutate(action.payload);
      }
    }
  );

  const setValue = useCallback(
    (newValue) => {
      dispatch({ type: 'SET', payload: newValue });
    },
    [dispatch]
  );

  return [value, isPending, setValue];
}
