import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
    handleNudgeDismissed,
    handleGetTodos,
    handleToggleTodo,
    handleGetCurrentFocus,
    routeMessage,
    type MessageContext,
} from '../messageHandlers';

// Create mock functions
const mockStorage = {
    getLastNudge: vi.fn().mockResolvedValue(0),
    setLastNudge: vi.fn().mockResolvedValue(undefined),
    getTodos: vi.fn().mockResolvedValue([]),
    setTodos: vi.fn().mockResolvedValue(undefined),
    getCurrentFocus: vi.fn().mockResolvedValue(null),
    setCurrentFocus: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({ aiEnabled: false }),
    addKeywords: vi.fn().mockResolvedValue(undefined),
    clearRecentURLs: vi.fn().mockResolvedValue(undefined),
    clearCheckedUrls: vi.fn().mockResolvedValue(undefined),
    isBlacklisted: vi.fn().mockResolvedValue(false),
    isWhitelisted: vi.fn().mockResolvedValue(false),
    isTabBypassed: vi.fn().mockResolvedValue(false),
    addBypassedTab: vi.fn().mockResolvedValue(undefined),
    recordCompletedTask: vi.fn().mockResolvedValue(undefined),
};

// Mock storage
vi.mock('@/lib/storage', () => ({
    storage: mockStorage,
}));

// Mock iconManager
vi.mock('@/lib/iconManager', () => ({
    setIconState: vi.fn().mockResolvedValue(undefined),
}));

// Mock aiService
vi.mock('@/lib/aiService', () => ({
    getTabSummary: vi.fn().mockResolvedValue(''),
}));

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
    browser: {
        tabs: {
            query: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        },
        windows: {
            update: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

describe('handleNudgeDismissed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sets lastNudge timestamp and returns success', async () => {
        const result = await handleNudgeDismissed();

        expect(mockStorage.setLastNudge).toHaveBeenCalled();
        expect(result).toEqual({ success: true });
    });
});

describe('handleGetTodos', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns todos from storage', async () => {
        const mockTodos = [
            { id: '1', text: 'Test todo', completed: false },
            { id: '2', text: 'Another todo', completed: true },
        ];
        mockStorage.getTodos.mockResolvedValue(mockTodos);

        const result = await handleGetTodos();

        expect(result).toEqual({ todos: mockTodos });
    });

    it('returns empty array when no todos', async () => {
        mockStorage.getTodos.mockResolvedValue([]);

        const result = await handleGetTodos();

        expect(result).toEqual({ todos: [] });
    });
});

describe('handleToggleTodo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('toggles todo completed state', async () => {
        const mockTodos = [
            { id: '1', text: 'Test todo', completed: false },
            { id: '2', text: 'Another', completed: true },
        ];
        mockStorage.getTodos.mockResolvedValue(mockTodos);

        const result = await handleToggleTodo({ type: 'TOGGLE_TODO', todoId: '1' });

        expect(mockStorage.setTodos).toHaveBeenCalledWith([
            { id: '1', text: 'Test todo', completed: true },
            { id: '2', text: 'Another', completed: true },
        ]);
        expect(result.todos[0].completed).toBe(true);
    });

    it('sets lastNudge after toggle', async () => {
        mockStorage.getTodos.mockResolvedValue([]);

        await handleToggleTodo({ type: 'TOGGLE_TODO', todoId: '1' });

        expect(mockStorage.setLastNudge).toHaveBeenCalled();
    });
});

describe('handleGetCurrentFocus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns current focus session', async () => {
        const mockFocus = {
            originTabId: 1,
            pageTitle: 'Test',
            startTime: Date.now(),
        };
        mockStorage.getCurrentFocus.mockResolvedValue(mockFocus);

        const result = await handleGetCurrentFocus();

        expect(result).toEqual({ currentFocus: mockFocus });
    });

    it('returns null when no focus session', async () => {
        mockStorage.getCurrentFocus.mockResolvedValue(null);

        const result = await handleGetCurrentFocus();

        expect(result).toEqual({ currentFocus: null });
    });
});

describe('routeMessage', () => {
    const mockContext: MessageContext = {
        senderTabId: 1,
        tabTimes: new Map(),
        sendMessageToContentScript: vi.fn().mockResolvedValue(true),
    };

    const mockCallbacks = {
        clearCheckedUrls: vi.fn(),
        resetLastFocusTabVisitTime: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes GET_TODOS to correct handler', async () => {
        const mockTodos = [{ id: '1', text: 'Test', completed: false }];
        mockStorage.getTodos.mockResolvedValue(mockTodos);

        const result = await routeMessage(
            { type: 'GET_TODOS' },
            mockContext,
            mockCallbacks
        );

        expect(result).toEqual({ todos: mockTodos });
    });

    it('routes NUDGE_DISMISSED to correct handler', async () => {
        const result = await routeMessage(
            { type: 'NUDGE_DISMISSED' },
            mockContext,
            mockCallbacks
        );

        expect(result).toEqual({ success: true });
    });

    it('returns error for unknown message type', async () => {
        const result = await routeMessage(
            { type: 'UNKNOWN_TYPE' },
            mockContext,
            mockCallbacks
        );

        expect(result).toEqual({ error: 'unknown_message_type' });
    });

    it('routes GET_CURRENT_FOCUS to correct handler', async () => {
        mockStorage.getCurrentFocus.mockResolvedValue(null);

        const result = await routeMessage(
            { type: 'GET_CURRENT_FOCUS' },
            mockContext,
            mockCallbacks
        );

        expect(result).toEqual({ currentFocus: null });
    });
});
