import React, { useState } from 'react';
import { Home, BarChart3, Bell, User, UploadCloud, Settings, Palette, Moon, Sun, Mic, Menu, X, ShieldAlert } from 'lucide-react';
import { UserProfile, RANK_ORDER } from '../types';
import { VisitorIdentity } from '../utils/visitor';
import { TwinklingStars } from './TwinklingStars';
import { InstallAppButton } from './InstallAppButton';

const HOME_TUTORIAL_NEVER_REMIND_KEY = 'echostars_home_tutorial_never_remind_v1';

export type NavTab = 'home' | 'stats' | 'notifications' | 'profile' | 'upload' | 'admin';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogoClick?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onRandomPalette: () => void;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  canUpload?: boolean;
  pendingNotificationsCount?: number;
  visitor?: VisitorIdentity;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onLogoClick,
  isDark,
  onToggleTheme,
  onRandomPalette,
  currentUser,
  isAdmin,
  canUpload = true,
  pendingNotificationsCount = 0,
  visitor
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Requirement: 超級管理員只有一位 yukidu@gmail.com
  const cleanEmail = currentUser?.email?.toLowerCase().trim();
  const isSuperAdmin = isAdmin || cleanEmail === 'yukidu@gmail.com' || currentUser?.role === '超級管理員';
  const isAdministrator = currentUser?.isAdminUser === true || currentUser?.role === '管理員' || currentUser?.role === '獎銜審核員';
  // Requirement 1 (v2.4): 主選單名稱改為：首頁播放清單、排行榜、通知與獎銜審核（若無審核權限則只顯示「通知」）、上傳音檔、個人中心、後台管理
  const canAudit = isSuperAdmin || isAdministrator || cleanEmail === 'yukidu@gmail.com' || currentUser?.role === '獎銜審核員' || currentUser?.isAdminUser === true;
  const notificationsMenuTitle = canAudit ? '通知與獎銜審核' : '通知';

  // Requirement 11: 首頁置頂主選單，直接顯示目前名字+身份，分二行顯示，如果名稱太長，自動縮小字體符合4個字的寬度，身份用底色橢圓框區隔
  const displayName = currentUser?.name || visitor?.fullName || '勇敢的獅子';
  const displayRole = !currentUser
    ? '訪客'
    : isSuperAdmin
    ? '超級管理員'
    : isAdministrator
    ? '管理員'
    : currentUser.isContributor
    ? '貢獻者'
    : (currentUser.rank || '會員');

  const nameLen = Array.from(displayName).length;
  // Requirement 11: 名稱如果太長，自動縮小字體以符合 4 個字的寬度
  const nameFontSize = nameLen <= 4 ? 12 : Math.max(8.5, Math.round((4 / nameLen) * 12 * 10) / 10);
  const mobileNameFontSize = nameLen <= 4 ? 11 : Math.max(8, Math.round((4 / nameLen) * 11 * 10) / 10);

  // Requirement 7 & Requirement 2: 齒輪功能「管理員、白金含白金以上、貢獻者」可使用進入數據中心
  const userRank = currentUser?.rank || '';
  const isDiamondOrAbove = isAdministrator || isSuperAdmin || userRank.includes('鑽石') || userRank.includes('皇冠') || userRank.includes('大使');
  const isPlatinumOrAbove = isDiamondOrAbove || (() => {
    if (!userRank) return false;
    if (
      userRank.includes('白金') ||
      userRank.includes('翡翠') ||
      userRank.includes('明珠') ||
      userRank.includes('紅寶石') ||
      userRank.includes('藍寶石')
    ) {
      return true;
    }
    const idx = (RANK_ORDER as readonly string[]).indexOf(userRank);
    return idx >= 26; // index of '白金'
  })();
  const isContributor = currentUser?.isContributor === true;
  const canAccessSettings = isSuperAdmin || isAdministrator || isPlatinumOrAbove || isContributor;

  const handleMobileNav = (tab: NavTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(HOME_TUTORIAL_NEVER_REMIND_KEY) !== '1';
  });
  const [neverRemindTutorial, setNeverRemindTutorial] = useState(false);

  const handleNeverRemindTutorialChange = (checked: boolean) => {
    setNeverRemindTutorial(checked);
    if (typeof window === 'undefined') return;
    if (checked) {
      localStorage.setItem(HOME_TUTORIAL_NEVER_REMIND_KEY, '1');
    } else {
      localStorage.removeItem(HOME_TUTORIAL_NEVER_REMIND_KEY);
    }
  };

  const dismissTutorial = () => { setShowTutorial(false); };
  const handleLogoClick = () => {
    dismissTutorial();
    if (onLogoClick) {
      onLogoClick();
    } else {
      handleMobileNav('home');
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-[var(--theme-border-subtle,#f1e7ea)] dark:border-slate-800 transition-colors shadow-xs relative">
      {/* Requirement 4: 置頂主選單繁星閃爍特效 */}
      <TwinklingStars density="subtle" className="opacity-75 dark:opacity-90" />

      <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between">
        {/* Brand Logo - 點擊左上角麥克風圖或繁星回聲，返回首頁播放清單「全部分類」，清空搜尋條件 */}
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-hidden cursor-pointer"
          title="返回首頁播放清單（全部分類）"
        >
          <div
            className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105"
            style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
          >
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white transition-transform group-hover:scale-110" />
            {/* Pulsing ring indicator */}
            <span className="absolute inset-0 rounded-2xl border-2 animate-ping" style={{ borderColor: 'var(--color-primary, #c06c84)' }} />
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="text-base sm:text-xl font-black tracking-wider echo-wave-text inline-flex items-baseline"
              style={{ color: 'var(--color-primary, #c06c84)' }}
            >
              <span>繁星回聲</span>
            </span>

            {/* Sound wave bars animation - matches active theme palette */}
            <div className="hidden sm:flex items-center gap-0.5 h-4 ml-0.5">
              <span className="w-0.5 rounded-full animate-[pulseWaveBar_1.2s_ease-in-out_infinite]" style={{ backgroundColor: 'var(--color-primary, #c06c84)' }} />
              <span className="w-0.5 rounded-full animate-[pulseWaveBar_1.2s_ease-in-out_0.2s_infinite]" style={{ backgroundColor: 'var(--color-primary, #c06c84)' }} />
              <span className="w-0.5 rounded-full opacity-80 animate-[pulseWaveBar_1.2s_ease-in-out_0.4s_infinite]" style={{ backgroundColor: 'var(--color-primary, #c06c84)' }} />
              <span className="w-0.5 rounded-full opacity-60 animate-[pulseWaveBar_1.2s_ease-in-out_0.6s_infinite]" style={{ backgroundColor: 'var(--color-primary, #c06c84)' }} />
            </div>
          </div>
        </button>

        {showTutorial && (
          <div
            role="status"
            className="absolute top-full left-3 z-[80] max-w-[calc(100vw-24px)] rounded-2xl bg-[var(--color-primary)] text-white p-4 shadow-xl border-2 border-white"
          >
            <div className="absolute -top-8 left-10 text-4xl font-black text-[var(--color-primary)]" aria-hidden="true">↑</div>
            <p className="font-bold text-lg">按這裡回首頁播放清單</p>
            <label className="mt-3 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={neverRemindTutorial}
                onChange={e => handleNeverRemindTutorialChange(e.target.checked)}
                className="w-4 h-4 rounded border-white/70 accent-white cursor-pointer"
              />
              <span className="font-bold text-sm">永遠不再提醒！</span>
            </label>
            <button type="button" onClick={dismissTutorial} className="mt-2 rounded-lg bg-white/20 px-3 py-2">
              知道了
            </button>
          </div>
        )}
        {/* Desktop Navigation Controls (Hidden on small mobile screens) */}
        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          {/* Home */}
          <button
            onClick={handleLogoClick}
            title="首頁播放清單（全部分類）"
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              currentTab === 'home'
                ? 'bg-rose-100/90 dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Statistics Tab - 排行榜 */}
          <button
            onClick={() => onSelectTab('stats')}
            title="排行榜"
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              currentTab === 'stats'
                ? 'bg-rose-100/90 dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          {/* Requirement 7 & 11: 通知鈴鐺顏色連動主色系 */}
          {currentUser && (
            <button
              onClick={() => onSelectTab('notifications')}
              title={notificationsMenuTitle}
              className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${
                currentTab === 'notifications'
                  ? 'shadow-xs font-bold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              style={{
                color: 'var(--color-primary, #c06c84)',
                backgroundColor: currentTab === 'notifications' ? 'var(--color-light-pill, #fae8ed)' : undefined
              }}
            >
              <Bell className="w-5 h-5" style={{ color: 'var(--color-primary, #c06c84)' }} />
              {pendingNotificationsCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-xs animate-pulse"
                  style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                >
                  {pendingNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Upload Audio */}
          {canUpload && (
            <button
              onClick={() => onSelectTab('upload')}
              title="上傳音檔"
              className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                currentTab === 'upload'
                  ? 'bg-rose-100/90 dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </button>
          )}

          {/* Requirement 11: 首頁置頂主選單，直接顯示目前名字+身份，分二行顯示，名稱長自動縮小字體符合4個字寬度，身份用底色橢圓框區隔 */}
          <button
            onClick={() => onSelectTab('profile')}
            title="個人中心"
            className={`px-2 py-1 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center cursor-pointer min-w-[58px] max-w-[96px] sm:max-w-[120px] ${
              currentTab === 'profile'
                ? 'bg-rose-100/90 dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span
              style={{ fontSize: `${nameFontSize}px` }}
              className="font-bold text-slate-800 dark:text-slate-100 truncate w-full text-center leading-tight tracking-tight"
            >
              {displayName}
            </span>
            <span className="text-[9px] px-2 py-[1px] mt-0.5 rounded-full font-bold bg-[var(--color-light-pill,#fae8ed)] text-[var(--color-primary,#c06c84)] border border-[var(--theme-border-subtle,#f1e7ea)] dark:bg-slate-800 dark:text-rose-300 dark:border-slate-700 leading-none whitespace-nowrap shadow-2xs">
              {displayRole}
            </span>
            {currentUser && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Admin Management */}
          {canAccessSettings && (
            <button
              onClick={() => onSelectTab('admin')}
              title="後台管理"
              className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${
                currentTab === 'admin'
                  ? 'bg-rose-100/90 dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-5 h-5" />
              {isSuperAdmin && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />



          {/* Dynamic Light Theme Generator */}
          <button
            onClick={onRandomPalette}
            title="隨機切換清新漸層配色"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all active:rotate-45"
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? '切換為淺色模式' : '切換為深色模式'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all active:scale-95"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Action Buttons - Requirement 11 & Requirement 7 */}
        <div className="flex items-center gap-1 md:hidden">
          {/* Requirement 11: 2-line name + identity badge on mobile */}
          <button
            type="button"
            onClick={() => handleMobileNav('profile')}
            className={`px-1 py-0.5 rounded-xl transition-colors flex flex-col items-center justify-center text-center min-w-[50px] max-w-[68px] shrink-0 ${
              currentTab === 'profile'
                ? 'bg-rose-100 text-rose-700 dark:bg-slate-800 dark:text-rose-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={currentUser ? `個人檔案 (${currentUser.name})` : `目前身分：${displayName} (訪客)`}
          >
            <span
              style={{ fontSize: `${mobileNameFontSize}px` }}
              className="font-bold text-slate-800 dark:text-slate-100 truncate w-full text-center leading-tight tracking-tight"
            >
              {displayName}
            </span>
            <span className="text-[8.5px] px-1.5 py-[0.5px] mt-0.5 rounded-full font-bold bg-[var(--color-light-pill,#fae8ed)] text-[var(--color-primary,#c06c84)] border border-[var(--theme-border-subtle,#f1e7ea)] dark:bg-slate-800 dark:text-rose-300 dark:border-slate-700 leading-none whitespace-nowrap shadow-2xs">
              {displayRole}
            </span>
          </button>

          {/* Requirement 7: 訪客身分，隱藏主選單的「通知」按鈕 */}
          {currentUser && (
            <button
              type="button"
              onClick={() => handleMobileNav('notifications')}
              className={`relative p-1.5 sm:p-2 rounded-xl transition-colors ${
                currentTab === 'notifications'
                  ? 'bg-rose-100 text-rose-700 dark:bg-slate-800 dark:text-rose-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={notificationsMenuTitle}
              aria-label={notificationsMenuTitle}
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
              {pendingNotificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                  {pendingNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Random Palette on mobile */}
          <button
            onClick={onRandomPalette}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:rotate-45"
            title="隨機切換配色"
            aria-label="隨機配色"
          >
            <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-primary,#c06c84)]" />
          </button>

          {/* Quick theme toggle on mobile */}


          <button
            onClick={onToggleTheme}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? '切換淺色模式' : '切換深色模式'}
            aria-label="深淺色切換"
          >
            {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition-colors ml-0.5"
            title="開啟選單"
            aria-label="選單"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg px-4 py-3 shadow-xl animate-in slide-in-from-top-2 space-y-1">
          <button
            onClick={handleLogoClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              currentTab === 'home'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>首頁播放清單</span>
          </button>

          <button
            onClick={() => handleMobileNav('stats')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              currentTab === 'stats'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>排行榜</span>
          </button>

          {/* Requirement 7: 訪客身分，隱藏主選單的「通知」按鈕 */}
          {currentUser && (
            <button
              onClick={() => handleMobileNav('notifications')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                currentTab === 'notifications'
                  ? 'font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={{
                backgroundColor: currentTab === 'notifications' ? 'var(--color-light-pill, #fae8ed)' : undefined,
                color: currentTab === 'notifications' ? 'var(--color-primary, #c06c84)' : undefined
              }}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4" style={{ color: 'var(--color-primary, #c06c84)' }} />
                <span>{notificationsMenuTitle}</span>
              </div>
              {pendingNotificationsCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                >
                  {pendingNotificationsCount} 待審
                </span>
              )}
            </button>
          )}

          {canUpload && (
            <button
              onClick={() => handleMobileNav('upload')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                currentTab === 'upload'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>上傳音檔</span>
            </button>
          )}

          <button
            onClick={() => handleMobileNav('profile')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              currentTab === 'profile'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>個人中心</span>
          </button>

          <InstallAppButton />

          {canAccessSettings && (
            <button
              onClick={() => handleMobileNav('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                currentTab === 'admin'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>後台管理</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
