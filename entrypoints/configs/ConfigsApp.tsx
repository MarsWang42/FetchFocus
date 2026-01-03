import { browser } from 'wxt/browser';
import { useState, useEffect, useCallback } from 'react';
import { Shield, ListCheck, Calendar, Plus, Trash2, Sparkles, Tag, CornerDownLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CalendarView from '@/components/CalendarView';
import { storage } from '@/lib/storage';
import type { BlacklistEntry, WhitelistEntry, Settings, TodoCategory } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

const t = (key: string, substitutions?: string | string[]) =>
    browser.i18n.getMessage(key as any, substitutions) || key;

function ConfigsApp() {
    const [activeTab, setActiveTab] = useState('blacklist');
    const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
    const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [newBlacklistPattern, setNewBlacklistPattern] = useState('');
    const [newWhitelistPattern, setNewWhitelistPattern] = useState('');
    const [categories, setCategories] = useState<TodoCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryKeywords, setNewCategoryKeywords] = useState<string[]>([]);
    const [newCategoryKeywordInput, setNewCategoryKeywordInput] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [bl, wl, s, cats] = await Promise.all([
                storage.getBlacklist(),
                storage.getWhitelist(),
                storage.getSettings(),
                storage.getCategories(),
            ]);
            setBlacklist(bl);
            setWhitelist(wl);
            setSettings(s);
            setCategories(cats);
        };
        loadData();
    }, []);

    const handleAddBlacklist = useCallback(async () => {
        const pattern = newBlacklistPattern.trim().toLowerCase();
        if (!pattern) return;
        await storage.addToBlacklist(pattern);
        setBlacklist(await storage.getBlacklist());
        setNewBlacklistPattern('');
    }, [newBlacklistPattern]);

    const handleRemoveBlacklist = useCallback(async (pattern: string) => {
        await storage.removeFromBlacklist(pattern);
        setBlacklist(await storage.getBlacklist());
    }, []);

    const handleAddWhitelist = useCallback(async () => {
        const pattern = newWhitelistPattern.trim().toLowerCase();
        if (!pattern) return;
        await storage.addToWhitelist(pattern);
        setWhitelist(await storage.getWhitelist());
        setNewWhitelistPattern('');
    }, [newWhitelistPattern]);

    const handleRemoveWhitelist = useCallback(async (pattern: string) => {
        await storage.removeFromWhitelist(pattern);
        setWhitelist(await storage.getWhitelist());
    }, []);

    const handleToggleAI = useCallback(async (enabled: boolean) => {
        const updatedSettings = { ...settings, aiEnabled: enabled };
        setSettings(updatedSettings);
        await storage.setSettings(updatedSettings);
    }, [settings]);

    const handleAddCategory = useCallback(async () => {
        const name = newCategoryName.trim();
        if (!name || newCategoryKeywords.length === 0) return;
        const category: TodoCategory = {
            id: crypto.randomUUID(),
            name,
            keywords: newCategoryKeywords,
            createdAt: Date.now(),
        };
        await storage.addCategory(category);
        setCategories(await storage.getCategories());
        setNewCategoryName('');
        setNewCategoryKeywords([]);
        setNewCategoryKeywordInput('');
    }, [newCategoryName, newCategoryKeywords]);

    const handleRemoveCategory = useCallback(async (id: string) => {
        await storage.removeCategory(id);
        setCategories(await storage.getCategories());
    }, []);

    return (
        <div className="min-h-screen p-6 md:p-10">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <img
                            src="/icon/128.png"
                            alt="FetchFocus"
                            className="w-12 h-12 object-contain"
                        />
                        <h1 className="text-2xl font-bold text-slate-800">FetchFocus {t('settingsTitle')}</h1>
                    </div>
                </div>

                {/* Tabs */}
                <Card className="shadow-md border-amber-100/50 bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="w-full grid grid-cols-5 mb-6">
                                <TabsTrigger value="blacklist" className="gap-1.5">
                                    <Shield className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('blacklist')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="whitelist" className="gap-1.5">
                                    <ListCheck className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('whitelist')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="categories" className="gap-1.5">
                                    <Tag className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('categories')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="calendar" className="gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('calendar')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="ai" className="gap-1.5">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('aiTab')}</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Blacklist Tab */}
                            <TabsContent value="blacklist">
                                <div className="space-y-4">
                                    <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                                        <p className="text-sm text-slate-600 mb-2">{t('blacklistDescription')}</p>
                                        <p className="text-xs text-slate-400">{t('blacklistExample')}</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={t('addDomainPlaceholder')}
                                            value={newBlacklistPattern}
                                            onChange={(e) => setNewBlacklistPattern(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddBlacklist()}
                                            className="flex-1"
                                        />
                                        <Button onClick={handleAddBlacklist} disabled={!newBlacklistPattern.trim()}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {blacklist.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-4 italic">
                                                {t('noBlacklistEntries')}
                                            </p>
                                        ) : (
                                            blacklist.map((entry) => (
                                                <div
                                                    key={entry.pattern}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group"
                                                >
                                                    <span className="text-sm text-slate-700">{entry.pattern}</span>
                                                    <button
                                                        onClick={() => handleRemoveBlacklist(entry.pattern)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Whitelist Tab */}
                            <TabsContent value="whitelist">
                                <div className="space-y-4">
                                    <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
                                        <p className="text-sm text-slate-600 mb-2">{t('whitelistDescription')}</p>
                                        <p className="text-xs text-slate-400">{t('whitelistExample')}</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={t('addDomainPlaceholder')}
                                            value={newWhitelistPattern}
                                            onChange={(e) => setNewWhitelistPattern(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddWhitelist()}
                                            className="flex-1"
                                        />
                                        <Button onClick={handleAddWhitelist} disabled={!newWhitelistPattern.trim()}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {whitelist.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-4 italic">
                                                {t('noWhitelistEntries')}
                                            </p>
                                        ) : (
                                            whitelist.map((entry) => (
                                                <div
                                                    key={entry.pattern}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group"
                                                >
                                                    <span className="text-sm text-slate-700">{entry.pattern}</span>
                                                    <button
                                                        onClick={() => handleRemoveWhitelist(entry.pattern)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Categories Tab */}
                            <TabsContent value="categories">
                                <div className="space-y-4">
                                    <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                                        <p className="text-sm text-slate-600 mb-2">{t('categoriesDescription')}</p>
                                        <p className="text-xs text-slate-400">{t('categoriesExample')}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Input
                                            placeholder={t('categoryNamePlaceholder')}
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            className="w-full"
                                        />
                                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border border-slate-200 rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-purple-400 focus-within:border-purple-400">
                                            {newCategoryKeywords.map((keyword, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full"
                                                >
                                                    {keyword}
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewCategoryKeywords(newCategoryKeywords.filter((_, i) => i !== index))}
                                                        className="text-purple-600 hover:text-purple-800 ml-0.5 cursor-pointer"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                placeholder={newCategoryKeywords.length === 0 ? t('categoryKeywordsPlaceholder') : ''}
                                                value={newCategoryKeywordInput}
                                                onChange={(e) => setNewCategoryKeywordInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newCategoryKeywordInput.trim()) {
                                                        e.preventDefault();
                                                        if (!newCategoryKeywords.includes(newCategoryKeywordInput.trim())) {
                                                            setNewCategoryKeywords([...newCategoryKeywords, newCategoryKeywordInput.trim()]);
                                                        }
                                                        setNewCategoryKeywordInput('');
                                                    } else if (e.key === 'Backspace' && newCategoryKeywordInput === '' && newCategoryKeywords.length > 0) {
                                                        setNewCategoryKeywords(newCategoryKeywords.slice(0, -1));
                                                    }
                                                }}
                                                className="flex-1 min-w-[100px] text-sm bg-transparent border-none outline-none placeholder:text-slate-400"
                                            />
                                            {newCategoryKeywordInput.trim() && (
                                                <CornerDownLeft className="w-4 h-4 text-slate-400 shrink-0" />
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleAddCategory}
                                            disabled={!newCategoryName.trim() || newCategoryKeywords.length === 0}
                                            className="w-full"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            {t('addCategory')}
                                        </Button>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {categories.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-4 italic">
                                                {t('noCategoriesYet')}
                                            </p>
                                        ) : (
                                            categories.map((category) => (
                                                <div
                                                    key={category.id}
                                                    className="flex items-start justify-between p-3 bg-slate-50 rounded-lg group"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-700">{category.name}</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {category.keywords.map((keyword, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full"
                                                                >
                                                                    {keyword}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveCategory(category.id)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Calendar Tab */}
                            <TabsContent value="calendar">
                                <CalendarView />
                            </TabsContent>

                            {/* AI Tab */}
                            <TabsContent value="ai">
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                        <p className="text-sm text-slate-600 mb-2">{t('aiDescription')}</p>
                                        <p className="text-xs text-slate-400">{t('localGeminiNano')}</p>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="w-5 h-5 text-blue-500" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-700">{t('aiContentAnalysis')}</p>
                                                <p className="text-xs text-slate-500">{settings.aiEnabled ? t('aiStatusEnabled') : t('aiStatusDisabled')}</p>
                                            </div>
                                        </div>
                                        <Switch checked={settings.aiEnabled} onCheckedChange={handleToggleAI} />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    FetchFocus — {t('footerTagline')}
                </p>
            </div>
        </div>
    );
}

export default ConfigsApp;
