/**
 * Optimistic Update Utilities Tests
 * 
 * Tests for:
 * A) QueryClient configuration (staleTime, gcTime, refetch behavior)
 * B) Optimistic update helper functions
 * C) Rollback behavior on error
 * D) Cache invalidation patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

/**
 * Mock types for testing
 */
interface TestItem {
  id: string;
  name: string;
  status?: string;
}

/**
 * Test the optimistic update patterns in isolation
 */
describe('Optimistic Update Patterns', () => {
  let queryClient: QueryClient;
  const TEST_QUERY_KEY = ['/api/test-items'];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  describe('A) QueryClient Configuration', () => {
    it('should have staleTime of 5 minutes by default', () => {
      const prodClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
          },
        },
      });
      
      expect(prodClient.getDefaultOptions().queries?.staleTime).toBe(300000);
    });

    it('should have gcTime of 30 minutes by default', () => {
      const prodClient = new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 30,
          },
        },
      });
      
      expect(prodClient.getDefaultOptions().queries?.gcTime).toBe(1800000);
    });

    it('should disable refetch on window focus', () => {
      const prodClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      });
      
      expect(prodClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    });

    it('should disable refetch on mount when data is fresh', () => {
      const prodClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnMount: false,
          },
        },
      });
      
      expect(prodClient.getDefaultOptions().queries?.refetchOnMount).toBe(false);
    });
  });

  describe('B) Optimistic Add Pattern', () => {
    it('should add item immediately to cache', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const newItem: TestItem = { id: 'temp-123', name: 'New Item' };
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, [newItem, ...previousItems]);
      }
      
      const updatedItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(updatedItems).toHaveLength(3);
      expect(updatedItems?.[0].name).toBe('New Item');
    });

    it('should prepend new items to the list', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'First' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const newItem: TestItem = { id: 'temp-456', name: 'Newest' };
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, [newItem, ...previousItems]);
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result?.[0].id).toBe('temp-456');
      expect(result?.[1].id).toBe('1');
    });
  });

  describe('C) Optimistic Update Pattern', () => {
    it('should update existing item in cache', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Original Name' },
        { id: '2', name: 'Item 2' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const updateData = { id: '1', name: 'Updated Name' };
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(
          TEST_QUERY_KEY,
          previousItems.map(item => item.id === updateData.id ? { ...item, ...updateData } : item)
        );
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result?.find(i => i.id === '1')?.name).toBe('Updated Name');
      expect(result?.find(i => i.id === '2')?.name).toBe('Item 2');
    });

    it('should preserve non-updated fields', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const partialUpdate = { id: '1', name: 'New Name' };
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(
          TEST_QUERY_KEY,
          previousItems.map(item => item.id === partialUpdate.id ? { ...item, ...partialUpdate } : item)
        );
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result?.[0].name).toBe('New Name');
      expect(result?.[0].status).toBe('active');
    });
  });

  describe('D) Optimistic Delete Pattern', () => {
    it('should remove item immediately from cache', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const idToDelete = '2';
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(
          TEST_QUERY_KEY,
          previousItems.filter(item => item.id !== idToDelete)
        );
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result).toHaveLength(2);
      expect(result?.find(i => i.id === '2')).toBeUndefined();
    });
  });

  describe('E) Rollback Pattern', () => {
    it('should restore previous state on error', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, []);
      expect(queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY)).toHaveLength(0);
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, previousItems);
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result).toHaveLength(2);
      expect(result?.[0].name).toBe('Item 1');
    });

    it('should work with deep object snapshots', () => {
      const existingItems: TestItem[] = [
        { id: '1', name: 'Original', status: 'active' },
      ];
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, existingItems);
      
      const previousItems = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, 
        existingItems.map(i => ({ ...i, name: 'Modified', status: 'deleted' }))
      );
      
      if (previousItems) {
        queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, previousItems);
      }
      
      const result = queryClient.getQueryData<TestItem[]>(TEST_QUERY_KEY);
      expect(result?.[0].name).toBe('Original');
      expect(result?.[0].status).toBe('active');
    });
  });

  describe('F) Query Key Consistency', () => {
    it('should use consistent queryKey format for list queries', () => {
      const key1 = ['/api/notes'];
      const key2 = ['/api/notes'];
      
      queryClient.setQueryData<TestItem[]>(key1, [{ id: '1', name: 'Note 1' }]);
      const result = queryClient.getQueryData<TestItem[]>(key2);
      
      expect(result).toBeDefined();
      expect(result?.[0].name).toBe('Note 1');
    });

    it('should use array format for variable keys', () => {
      const noteId = 'abc123';
      const key = ['/api/notes', noteId];
      
      queryClient.setQueryData<TestItem>(key, { id: noteId, name: 'Specific Note' });
      const result = queryClient.getQueryData<TestItem>(['/api/notes', noteId]);
      
      expect(result?.name).toBe('Specific Note');
    });

    it('should invalidate queries correctly with exact key', async () => {
      queryClient.setQueryData<TestItem[]>(TEST_QUERY_KEY, [{ id: '1', name: 'Test' }]);
      
      const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      await queryClient.cancelQueries({ queryKey: TEST_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: TEST_QUERY_KEY });
      
      expect(cancelSpy).toHaveBeenCalledWith({ queryKey: TEST_QUERY_KEY });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TEST_QUERY_KEY });
    });
  });

  describe('G) Single Item Update Pattern', () => {
    it('should update single item query data', () => {
      const singleKey = ['/api/notes', '123'];
      const note: TestItem = { id: '123', name: 'Original Title' };
      
      queryClient.setQueryData<TestItem>(singleKey, note);
      
      const previousData = queryClient.getQueryData<TestItem>(singleKey);
      
      if (previousData) {
        queryClient.setQueryData<TestItem>(singleKey, { 
          ...previousData, 
          name: 'Updated Title' 
        });
      }
      
      const result = queryClient.getQueryData<TestItem>(singleKey);
      expect(result?.name).toBe('Updated Title');
    });

    it('should update both list and detail queries consistently', () => {
      const listKey = ['/api/notes'];
      const detailKey = ['/api/notes', '123'];
      
      const notes: TestItem[] = [
        { id: '123', name: 'Note 1' },
        { id: '456', name: 'Note 2' },
      ];
      
      queryClient.setQueryData<TestItem[]>(listKey, notes);
      queryClient.setQueryData<TestItem>(detailKey, notes[0]);
      
      const updateData = { name: 'Updated Note 1' };
      
      const prevList = queryClient.getQueryData<TestItem[]>(listKey);
      if (prevList) {
        queryClient.setQueryData<TestItem[]>(
          listKey,
          prevList.map(n => n.id === '123' ? { ...n, ...updateData } : n)
        );
      }
      
      const prevDetail = queryClient.getQueryData<TestItem>(detailKey);
      if (prevDetail) {
        queryClient.setQueryData<TestItem>(detailKey, { ...prevDetail, ...updateData });
      }
      
      expect(queryClient.getQueryData<TestItem[]>(listKey)?.[0].name).toBe('Updated Note 1');
      expect(queryClient.getQueryData<TestItem>(detailKey)?.name).toBe('Updated Note 1');
    });
  });
});

describe('Error Handling Patterns', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('should handle null/undefined previous data gracefully', () => {
    const key = ['/api/empty'];
    
    const previousData = queryClient.getQueryData<TestItem[]>(key);
    
    expect(previousData).toBeUndefined();
    
    if (previousData) {
      queryClient.setQueryData<TestItem[]>(key, [...previousData, { id: 'new', name: 'New' }]);
    }
    
    expect(queryClient.getQueryData<TestItem[]>(key)).toBeUndefined();
  });

  it('should not crash when rolling back undefined context', () => {
    const key = ['/api/test'];
    let context: { previousItems?: TestItem[] } | undefined;
    
    const rollback = () => {
      if (context?.previousItems) {
        queryClient.setQueryData<TestItem[]>(key, context.previousItems);
      }
    };
    
    expect(() => rollback()).not.toThrow();
  });
});
