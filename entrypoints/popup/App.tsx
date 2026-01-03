import { browser } from 'wxt/browser';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Leaf, Square, Loader2, CornerDownLeft, CheckCircle, Settings as SettingsIcon } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { storage } from '@/lib/storage';
import type { Todo, Settings, FocusSession } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { Progress } from '@/components/ui/progress';


const t = (key: string, substitutions?: string | string[]) =>
  browser.i18n.getMessage(key as any, substitutions) || key;

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [newTodo, setNewTodo] = useState('');
  const [currentFocusDescription, setCurrentFocusDescription] = useState('');
  const [focusKeywords, setFocusKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFocus, setCurrentFocus] = useState<FocusSession | null>(null);
  const [currentTab, setCurrentTab] = useState<{ id: number; windowId: number; title: string; url: string; faviconUrl?: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isStartingFocus, setIsStartingFocus] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const [completedTodayCount, setCompletedTodayCount] = useState(0);
  const [includeCurrentTab, setIncludeCurrentTab] = useState(false);


  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedTodos, loadedSettings, loadedCurrentFocus] = await Promise.all([
          storage.getTodos(),
          storage.getSettings(),
          storage.getCurrentFocus(),
        ]);
        setTodos(loadedTodos.filter(t => !t.completed));
        setSettings(loadedSettings);
        setCurrentFocus(loadedCurrentFocus);

        // Load today's completed count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        const completedToday = await storage.getCompletedTasksInRange(today, endOfDay);
        setCompletedTodayCount(completedToday.length);

        // Get current tab info
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.windowId !== undefined && tab.title && tab.url) {
          setCurrentTab({
            id: tab.id,
            windowId: tab.windowId,
            title: tab.title,
            url: tab.url,
            faviconUrl: tab.favIconUrl,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();


    const unsubscribe = storage.onCurrentFocusChange(setCurrentFocus);
    return unsubscribe;
  }, []);

  // Update elapsed time every second when focus session is active
  useEffect(() => {
    if (!currentFocus) {
      setElapsedTime('');
      return;
    }

    const updateElapsed = () => {
      const elapsed = Date.now() - currentFocus.startTime;
      const totalSeconds = Math.floor(elapsed / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        setElapsedTime(t('focusingForHMS', [hours.toString(), minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')]));
      } else if (minutes > 0) {
        setElapsedTime(t('focusingForMS', [minutes.toString(), seconds.toString().padStart(2, '0')]));
      } else {
        setElapsedTime(t('focusingForS', [seconds.toString()]));
      }
    };

    updateElapsed(); // Initial update
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [currentFocus]);


  const handleAddTodo = useCallback(async () => {
    if (!newTodo.trim() || todos.length >= 5) return;

    const todo: Todo = {
      id: crypto.randomUUID(),
      text: newTodo.trim(),
      completed: false,
    };

    const updatedTodos = [...todos, todo];
    setTodos(updatedTodos);
    await storage.setTodos(updatedTodos);
    setNewTodo('');
  }, [newTodo, todos]);


  const handleToggleTodo = useCallback(
    async (id: string) => {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;

      // When completing a todo, remove it and record as completed task
      if (!todo.completed) {
        // Record as completed task for the calendar
        await storage.recordCompletedTask(todo.text);
        setCompletedTodayCount(prev => prev + 1);

        // Remove from todos list
        const updatedTodos = todos.filter(t => t.id !== id);
        setTodos(updatedTodos);
        await storage.setTodos(updatedTodos);
      } else {
        // If unchecking (shouldn't happen with new flow, but handle anyway)
        const updatedTodos = todos.map((t) =>
          t.id === id ? { ...t, completed: false } : t
        );
        setTodos(updatedTodos);
        await storage.setTodos(updatedTodos);
      }
    },
    [todos]
  );


  const handleRemoveTodo = useCallback(
    async (id: string) => {
      const updatedTodos = todos.filter((t) => t.id !== id);
      setTodos(updatedTodos);
      await storage.setTodos(updatedTodos);
    },
    [todos]
  );


  const handleToggleAI = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        // Turning off is always allowed
        const updatedSettings = { ...settings, aiEnabled: false };
        setSettings(updatedSettings);
        setAiError(null);
        await storage.setSettings(updatedSettings);
        return;
      }

      try {
        setAiError(null);
        // turning on - check availability
        const [lmAvailability, sumAvailability] = await Promise.all([
          (window as any).LanguageModel?.availability(),
          (window as any).Summarizer?.availability(),
        ]);

        const isAvailable = (status: string) => status === 'available' || status === 'read';
        const isDownloadable = (status: string) => status === 'downloadable' || status === 'after-download';

        if (isAvailable(lmAvailability) && isAvailable(sumAvailability)) {
          // Both available, just enable
          const updatedSettings = { ...settings, aiEnabled: true };
          setSettings(updatedSettings);
          await storage.setSettings(updatedSettings);
        } else if (isDownloadable(lmAvailability) || isDownloadable(sumAvailability)) {
          // Need to download
          setIsDownloading(true);
          setDownloadProgress(0);

          // Estimate total progress based on needed downloads
          const needsLm = isDownloadable(lmAvailability);
          const needsSum = isDownloadable(sumAvailability);
          const totalTasks = (needsLm ? 1 : 0) + (needsSum ? 1 : 0);
          let completedTasks = 0;

          const downloadModel = async (ModelClass: any) => {
            await ModelClass.create({
              monitor(m: any) {
                m.addEventListener('downloadprogress', (e: any) => {
                  const currentTaskProgress = (e.loaded / e.total) * 100;
                  // simplistic progress aggregation
                  const totalProgress = ((completedTasks * 100) + currentTaskProgress) / totalTasks;
                  setDownloadProgress(totalProgress);
                });
              }
            });
            completedTasks++;
          };

          if (needsLm) await downloadModel((window as any).LanguageModel);
          if (needsSum) await downloadModel((window as any).Summarizer);

          // Done downloading
          setIsDownloading(false);
          const updatedSettings = { ...settings, aiEnabled: true };
          setSettings(updatedSettings);
          await storage.setSettings(updatedSettings);
        } else {
          // Unavailable
          setAiError("AI models unavailable. Please enable the following flags:");
        }
      } catch (error) {
        console.error('Error checking/downloading AI models', error);
        setAiError("An error occurred while checking AI availability.");
        setIsDownloading(false);
      }
    },
    [settings]
  );


  const handleStartFocus = useCallback(async () => {
    if (includeCurrentTab && !currentTab) return;
    setIsStartingFocus(true);

    try {
      // Add to todos if not already present, and update keywords if exists
      const description = currentFocusDescription.trim();
      if (description) {
        const existingTodo = todos.find(t => t.text.toLowerCase() === description.toLowerCase());
        if (existingTodo) {
          // Update keywords for existing todo
          if (focusKeywords.length > 0) {
            const updatedTodos = todos.map(t =>
              t.id === existingTodo.id ? { ...t, keywords: focusKeywords } : t
            );
            setTodos(updatedTodos);
            await storage.setTodos(updatedTodos);
          }
        } else if (todos.length < 10) { // Allow slightly more when auto-adding
          const newTodoItem: Todo = {
            id: crypto.randomUUID(),
            text: description,
            completed: false,
            keywords: focusKeywords.length > 0 ? focusKeywords : undefined,
          };
          const updatedTodos = [...todos, newTodoItem];
          setTodos(updatedTodos);
          await storage.setTodos(updatedTodos);
        }
      }

      // Create message object
      const startFocusMessage: any = {
        type: 'START_FOCUS',
        focusDescription: description,
        focusKeywords: focusKeywords.length > 0 ? focusKeywords : undefined,
        startTime: Date.now(),
      };

      if (includeCurrentTab && currentTab) {
        startFocusMessage.tabId = currentTab.id;
        startFocusMessage.windowId = currentTab.windowId;
        startFocusMessage.pageTitle = currentTab.title;
        startFocusMessage.pageUrl = currentTab.url;
        startFocusMessage.faviconUrl = currentTab.faviconUrl;
      }

      // 1. Notify background script to save state (CRITICAL for data persistence)
      const response = await browser.runtime.sendMessage(startFocusMessage);

      // 2. Broadcast to all active tabs ONLY if successfully started
      if (response?.success) {
        browser.tabs.query({ discarded: false }, (tabs) => {
          for (const tab of tabs) {
            if (!tab.id) continue;
            // Catch errors for tabs without content scripts
            browser.tabs.sendMessage(tab.id, startFocusMessage).catch(() => { });
          }
        });
      }

      setCurrentFocusDescription('');
      setFocusKeywords([]);
      setKeywordInput('');
    } finally {
      setIsStartingFocus(false);
    }
  }, [currentTab, currentFocusDescription, todos, includeCurrentTab, focusKeywords]);


  const handleEndFocus = useCallback(async () => {
    browser.runtime.sendMessage({ type: 'END_FOCUS' });
    browser.tabs.query({ discarded: false }, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id) continue;
        browser.tabs.sendMessage(tab.id, {
          type: 'END_FOCUS',
        });
      }
    })
  }, []);


  const handleCompleteFocus = useCallback(async () => {
    if (currentFocus) {
      // Find matching todo by description or page title
      const focusText = currentFocus.description || currentFocus.pageTitle || '';
      const matchingTodo = todos.find(
        (t) => t.text.toLowerCase() === focusText.toLowerCase() && !t.completed
      );

      if (matchingTodo) {
        const updatedTodos = todos.map((t) =>
          t.id === matchingTodo.id ? { ...t, completed: true } : t
        );
        setTodos(updatedTodos);
        await storage.setTodos(updatedTodos);
      }
    }
    // Use COMPLETE_FOCUS to record the task and end session
    browser.runtime.sendMessage({ type: 'COMPLETE_FOCUS' });
    browser.tabs.query({ discarded: false }, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id) continue;
        browser.tabs.sendMessage(tab.id, { type: 'END_FOCUS' }).catch(() => { });
      }
    });
  }, [currentFocus, todos]);

  const handleOpenSettings = useCallback(() => {
    browser.tabs.create({ url: (browser.runtime.getURL as any)('/configs.html') });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Leaf className="w-8 h-8 text-golden-500 animate-pulse" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none rounded-none min-h-[400px]">
      <CardContent className="space-y-6 pt-6">
        {/* AI Setting - only show when AI is not enabled */}
        {!settings.aiEnabled && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted-blue-50 border border-muted-blue-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {t('aiContentAnalysis')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('localGeminiNano')}
                </p>
              </div>
            </div>
            <Switch checked={settings.aiEnabled} onCheckedChange={handleToggleAI} disabled={isDownloading} />
          </div>
        )}

        {/* Focus Session Section */}
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-slate-800 flex items-center justify-center gap-2 mb-1">
            {t('currentFocusSession')}
          </h4>

          {currentFocus ? (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                  {currentFocus.description || currentFocus.pageTitle}
                </h3>
                {currentFocus.description && (
                  <p className="text-xs text-slate-500 truncate" title={currentFocus.pageTitle}>
                    {currentFocus.pageTitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>{t('active')}</span>
                  </div>
                  <span>•</span>
                  <span>{elapsedTime}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCompleteFocus}
                  className="text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors gap-1 cursor-pointer h-7 px-2"
                  title={t('completeFocusSession')}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{t('complete')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEndFocus}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors gap-1 cursor-pointer h-7 px-2"
                  title={t('endFocusSession')}
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span className="text-xs font-medium">{t('stop')}</span>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div />
              <div className="space-y-3">
                <div className="space-y-2 relative">
                  <div className="relative">
                    <Input
                      placeholder={t('focusSessionPlaceholder')}
                      value={currentFocusDescription}
                      onChange={(e) => {
                        setCurrentFocusDescription(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      className="text-sm bg-amber-50/50 border-amber-200 focus:border-amber-400 placeholder:text-amber-500"
                    />
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                        {todos
                          .filter(t => !t.completed && (
                            currentFocusDescription === '' ||
                            t.text.toLowerCase().includes(currentFocusDescription.toLowerCase())
                          ))
                          .map(todo => (
                            <button
                              key={todo.id}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-colors border-b border-slate-100 last:border-0"
                              onClick={() => {
                                setCurrentFocusDescription(todo.text);
                                // Auto-fill saved keywords from the todo
                                if (todo.keywords && todo.keywords.length > 0) {
                                  setFocusKeywords(todo.keywords);
                                }
                              }}
                            >
                              {todo.text}
                            </button>
                          ))}
                        {todos.some(t => !t.completed && (currentFocusDescription === '' || t.text.toLowerCase().includes(currentFocusDescription.toLowerCase()))) ? null : (
                          currentFocusDescription && (
                            <div className="px-3 py-2 text-sm text-slate-400 italic">
                              {t('willCreateNewTask')}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  {/* Current Tab Indicator */}
                  {currentTab && (
                    <div className={`flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 transition-opacity ${!includeCurrentTab ? 'opacity-60' : ''}`}>
                      <div title={t('includeCurrentTab')}>
                        <Checkbox
                          checked={includeCurrentTab}
                          onCheckedChange={(checked) => setIncludeCurrentTab(checked === true)}
                          className="h-4 w-4"
                        />
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{t('withTab')}</span>
                      {currentTab.faviconUrl ? (
                        <img
                          src={currentTab.faviconUrl}
                          alt=""
                          className="w-4 h-4 shrink-0 rounded-sm"
                        />
                      ) : (
                        <div className="w-4 h-4 shrink-0 rounded-sm bg-slate-200" />
                      )}
                      <span
                        className="text-xs text-slate-600 truncate"
                        title={currentTab.title}
                      >
                        {currentTab.title}
                      </span>
                    </div>
                  )}

                  {/* Keywords Chip Input */}
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400">
                      {focusKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => setFocusKeywords(focusKeywords.filter((_, i) => i !== index))}
                            className="text-amber-600 hover:text-amber-800 ml-0.5 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder={focusKeywords.length === 0 ? t('keywordsPlaceholder') : ''}
                        value={keywordInput}
                        onChange={async (e) => {
                          setKeywordInput(e.target.value);
                          // Load suggestions based on input
                          const suggestions = await storage.getKeywordSuggestions(e.target.value);
                          // Filter out already selected keywords
                          setKeywordSuggestions(suggestions.filter(s => !focusKeywords.includes(s)));
                        }}
                        onFocus={async () => {
                          setShowKeywordSuggestions(true);
                          // Load initial suggestions
                          const suggestions = await storage.getKeywordSuggestions(keywordInput);
                          setKeywordSuggestions(suggestions.filter(s => !focusKeywords.includes(s)));
                        }}
                        onBlur={() => setTimeout(() => setShowKeywordSuggestions(false), 150)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && keywordInput.trim()) {
                            e.preventDefault();
                            if (!focusKeywords.includes(keywordInput.trim())) {
                              setFocusKeywords([...focusKeywords, keywordInput.trim()]);
                            }
                            setKeywordInput('');
                            setKeywordSuggestions([]);
                          } else if (e.key === 'Backspace' && keywordInput === '' && focusKeywords.length > 0) {
                            setFocusKeywords(focusKeywords.slice(0, -1));
                          }
                        }}
                        className="flex-1 min-w-[100px] text-sm bg-transparent border-none outline-none placeholder:text-slate-400"
                      />
                      {keywordInput.trim() && (
                        <CornerDownLeft className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                    {/* Keyword Suggestions Dropdown */}
                    {showKeywordSuggestions && keywordSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-32 overflow-y-auto">
                        {keywordSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-colors border-b border-slate-100 last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur
                              if (!focusKeywords.includes(suggestion)) {
                                setFocusKeywords([...focusKeywords, suggestion]);
                              }
                              setKeywordInput('');
                              setKeywordSuggestions(keywordSuggestions.filter(s => s !== suggestion));
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleStartFocus}
                    disabled={(!currentTab && includeCurrentTab) || !currentFocusDescription.trim() || isStartingFocus}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {isStartingFocus ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('startingFocus')}
                      </>
                    ) : (
                      t('startFocusSession')
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}


        </div>

        {/* Todo List */}
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-slate-800 flex items-center justify-center gap-2 mb-1">
            {t('todoList')}
          </h4>

          {/* Completed today message */}
          {completedTodayCount > 0 && (
            <div className="text-center text-sm text-green-600 font-medium">
              ✓ {t('completedTodayMessage', completedTodayCount.toString())}
            </div>
          )}

          {/* Todo list */}
          <div className="space-y-2">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 group"
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => handleToggleTodo(todo.id)}
                />
                <span
                  className={`flex-1 text-sm ${todo.completed
                    ? 'line-through text-slate-400'
                    : 'text-slate-700'
                    }`}
                >
                  {todo.text}
                </span>
                <button
                  onClick={() => handleRemoveTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={t('addTodo')}
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleAddTodo}
              disabled={!newTodo.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings Button */}
        <button
          onClick={handleOpenSettings}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{t('settingsTitle')}</span>
        </button>

        {isDownloading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{t('downloadingModels')}...</span>
              <span>{Math.round(downloadProgress)}%</span>
            </div>
            <Progress value={downloadProgress} className="h-1" />
          </div>
        )}

        {aiError && (
          <div className="mt-2 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded break-words">
            <p>{aiError}</p>
            {aiError.includes("Please enable") && (
              <>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  {[
                    "chrome://flags/#prompt-api-for-gemini-nano",
                    "chrome://flags/#prompt-api-for-gemini-nano-multimodal-input",
                    "chrome://flags/#summarization-api-for-gemini-nano"
                  ].map(url => (
                    <li key={url}>
                      <button
                        className="text-left underline hover:text-red-800 font-medium cursor-pointer"
                        onClick={() => browser.tabs.create({ url })}
                      >
                        {url}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">{t('relaunchChromeNote')}</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card >
  );
}

export default App;
