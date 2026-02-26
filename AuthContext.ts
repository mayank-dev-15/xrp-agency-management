import { createContext } from 'react';
import { User, AppSettings, PermissionKey, ToastType } from './types';

export interface AuthContextType {
  user: User | null;
  // Preview Mode
  previewUser: User | null;
  setPreviewUser: (u: User | null) => void;
  // Settings & Permissions
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  
  login: (u: User) => void;
  logout: () => void;
  loading: boolean;
  hasPermission: (perm: PermissionKey) => boolean;

  // Toast
  showToast: (message: string, type: ToastType) => void;

  // Global Confirm Dialog
  confirmAction: (options: {
      title?: string;
      description?: string;
      confirmText?: string;
      isDestructive?: boolean;
      onConfirm: () => Promise<void> | void;
  }) => void;
}

export const AuthContext = createContext<AuthContextType>(null!);
