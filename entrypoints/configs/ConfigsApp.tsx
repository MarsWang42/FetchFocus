import { browser } from 'wxt/browser';
import { useState, useEffect, useCallback } from 'react';
import { Shield, ListCheck, Calendar, Plus, Trash2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CalendarView from '@/components/CalendarView';
import { storage } from '@/lib/storage';
import type { BlacklistEntry, WhitelistEntry, Settings } from '@/lib/types';
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

    useEffect(() => {
        const loadData = async () => {
            const [bl, wl, s] = await Promise.all([
                storage.getBlacklist(),
                storage.getWhitelist(),
                storage.getSettings(),
            ]);
            setBlacklist(bl);
            setWhitelist(wl);
            setSettings(s);
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
                            <TabsList className="w-full grid grid-cols-4 mb-6">
                                <TabsTrigger value="blacklist" className="gap-1.5">
                                    <Shield className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('blacklist')}</span>
                                </TabsTrigger>
                                <TabsTrigger value="whitelist" className="gap-1.5">
                                    <ListCheck className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('whitelist')}</span>
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
