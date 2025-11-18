import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'bookly-theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored =
      typeof window !== 'undefined' ? (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) : null;
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const className = theme === 'dark' ? 'theme-dark' : 'theme-light';
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(className);
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(className);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

