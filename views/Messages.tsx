
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { User, Message, ChatThread } from '../types';
import { Send, Image as ImageIcon, Mic, MoreVertical, Search, Phone, Video, MessageSquare, Users, Megaphone, Trash2, Lock, Globe, Plus, X } from 'lucide-react';
import { formatJalaliShort } from '../utils';

const MessagesView = () => {
  const { user, confirmAction } = useContext(AuthContext);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
      const load = async () => {
          const t = await api.messages.getThreads();
          const u = await api.users.getAll();
          setThreads(t.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
          setUsers(u);
      };
      load();
  }, []);

  useEffect(() => {
      if(activeThreadId) {
          api.messages.getMessages(activeThreadId).then(setMessages);
          if (user) {
              api.messages.markThreadAsRead(activeThreadId, user.id);
              // Update local read status
              setThreads(prev => prev.map(t => {
                  if (t.id === activeThreadId) {
                      // This is a simplification. Ideally we'd check unread counts.
                      return t; 
                  }
                  return t;
              }));
          }
      }
  }, [activeThreadId]);

  const handleSend = async () => {
      if(!inputMsg.trim() || !activeThreadId) return;
      const msg: Message = {
          id: Math.random().toString(36).substr(2, 9),
          threadId: activeThreadId,
          senderId: user!.id,
          content: inputMsg,
          type: 'text',
          createdAt: new Date().toISOString(),
          isSeen: false
      };
      await api.messages.sendMessage(msg);
      setMessages(prev => [...prev, msg]);
      
      // Update thread preview in sidebar
      setThreads(prev => prev.map(t => {
          if (t.id === activeThreadId) {
              return { ...t, lastMessage: inputMsg, updatedAt: msg.createdAt };
          }
          return t;
      }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())); // Move to top
      
      setInputMsg('');
  };

  const createNewThread = async (targetUserId: string) => {
      // Check existing
      const existing = threads.find(t => t.type === 'direct' && t.participants.includes(targetUserId) && t.participants.includes(user!.id));
      if(existing) {
          setActiveThreadId(existing.id);
      } else {
          const newThread: ChatThread = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'direct',
              participants: [user!.id, targetUserId],
              updatedAt: new Date().toISOString()
          };
          await api.messages.createThread(newThread);
          setThreads(prev => [newThread, ...prev]);
          setActiveThreadId(newThread.id);
      }
      setShowNewChatModal(false);
  };

  const handleBroadcast = async (target: 'Team' | 'Clients') => {
      const newThread: ChatThread = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'broadcast',
          name: target === 'Team' ? '📢 اطلاعیه تیم' : '📢 اطلاعیه مشتریان',
          participants: [user!.id], 
          updatedAt: new Date().toISOString(),
          lastMessage: 'گروه ایجاد شد'
      };
      await api.messages.createThread(newThread);
      setThreads(prev => [...prev, newThread]);
      setActiveThreadId(newThread.id);
      setShowBroadcastModal(false);
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      confirmAction({
          description: 'آیا مطمئن هستید؟ گفتگو حذف خواهد شد.',
          onConfirm: async () => {
              try {
                  await api.messages.deleteThread(id, user!.id);
                  setThreads(prev => [...prev.filter(t => t.id !== id)]);
                  if(activeThreadId === id) setActiveThreadId(null);
              } catch(err) {
                  alert('خطا در حذف گفتگو');
              }
          }
      });
  };

  const getThreadName = (thread: ChatThread) => {
      if(thread.type === 'group' || thread.type === 'broadcast') return thread.name;
      const otherId = thread.participants.find(p => p !== user!.id);
      const u = users.find(usr => usr.id === otherId);
      return u ? `${u.firstName} ${u.lastName}` : 'کاربر ناشناس';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
        {/* Sidebar List */}
        <div className="w-80 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-lg">پیام‌ها</h3>
                     <div className="flex gap-2">
                         <button onClick={() => setShowNewChatModal(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 hover:text-primary-600 transition" title="گفتگوی جدید">
                             <Plus size={20}/>
                         </button>
                         <button onClick={() => setShowBroadcastModal(!showBroadcastModal)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 hover:text-primary-600 transition" title="ارسال همگانی">
                             <Megaphone size={20}/>
                         </button>
                     </div>
                </div>
                
                {showBroadcastModal && (
                    <div className="mb-4 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl flex gap-2 animate-in slide-in-from-top-2">
                        <button onClick={() => handleBroadcast('Team')} className="flex-1 text-xs bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition">همگانی تیم</button>
                        <button onClick={() => handleBroadcast('Clients')} className="flex-1 text-xs bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition">همگانی مشتری</button>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                    <input className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl py-2 pr-10 pl-4 text-sm outline-none focus:ring-1 focus:ring-primary-500/20 transition" placeholder="جستجو..."/>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {threads.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => setActiveThreadId(t.id)}
                        className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition group relative ${activeThreadId === t.id ? 'bg-primary-50 dark:bg-slate-700' : ''}`}
                    >
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                            {t.type === 'broadcast' ? <Megaphone size={18}/> : getThreadName(t)[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm truncate text-gray-800 dark:text-white">{getThreadName(t)}</h4>
                                <span className="text-[9px] text-gray-400">{formatJalaliShort(t.updatedAt)}</span>
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{t.lastMessage || 'شروع گفتگو'}</p>
                            
                            {/* Tags */}
                            <div className="flex gap-1 mt-1">
                                {t.type === 'direct' && (
                                    <span className="text-[9px] bg-gray-100 dark:bg-slate-600 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Lock size={8}/> خصوصی
                                    </span>
                                )}
                                {(t.type === 'group' || t.type === 'broadcast') && (
                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Globe size={8}/> عمومی
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <button 
                            type="button"
                            onClick={(e) => handleDeleteThread(e, t.id)}
                            className="absolute left-2 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition shadow-sm z-10 cursor-pointer"
                        >
                            <Trash2 size={14} className="pointer-events-none"/>
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
            {activeThreadId ? (
                <>
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                                {getThreadName(threads.find(t=>t.id === activeThreadId)!)[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white">{getThreadName(threads.find(t=>t.id === activeThreadId)!)}</h3>
                                <span className="text-xs text-green-500">آنلاین</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/50 custom-scrollbar">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.senderId === user!.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.senderId === user!.id ? 'bg-primary-500 text-white rounded-tl-none' : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-tr-none shadow-sm'}`}>
                                    {msg.content}
                                    <div className={`text-[10px] mt-1 text-right ${msg.senderId === user!.id ? 'text-primary-100' : 'text-gray-400'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}
                                        {msg.senderId === user!.id && (
                                            <span className="mr-1">{msg.isSeen ? '✓✓' : '✓'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                        <input 
                            className="flex-1 bg-gray-100 dark:bg-slate-900 border-none outline-none px-4 py-3 rounded-xl text-sm"
                            placeholder="پیام خود را بنویسید..."
                            value={inputMsg}
                            onChange={e => setInputMsg(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-500/30">
                            <Send size={18} className="rotate-180"/>
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <MessageSquare size={48} className="mb-4 opacity-50"/>
                    <p>یک گفتگو را انتخاب کنید یا پیام جدید ارسال کنید</p>
                    <div className="flex gap-2 mt-4">
                         {users.filter(u=>u.id!==user?.id).slice(0,3).map(u => (
                             <button key={u.id} onClick={() => createNewThread(u.id)} className="text-xs bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">{u.firstName}</button>
                         ))}
                    </div>
                </div>
            )}
        </div>

        {/* New Chat Modal */}
        {showNewChatModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 dark:text-white">شروع گفتگو جدید</h3>
                        <button onClick={() => setShowNewChatModal(false)} className="text-gray-500 hover:text-red-500 transition"><X size={20}/></button>
                    </div>
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                            <input 
                                className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-1 focus:ring-primary-500/20 transition"
                                placeholder="جستجو نام کاربر..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {users.filter(u => u.id !== user?.id && (u.firstName.includes(searchTerm) || u.lastName.includes(searchTerm))).length === 0 ? (
                            <div className="text-center text-gray-400 py-8 text-sm">کاربری یافت نشد</div>
                        ) : (
                            users.filter(u => u.id !== user?.id && (u.firstName.includes(searchTerm) || u.lastName.includes(searchTerm))).map(u => (
                                <button 
                                    key={u.id}
                                    onClick={() => createNewThread(u.id)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition text-right group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-slate-600 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-lg">
                                        {u.firstName[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 dark:text-white group-hover:text-primary-600 transition">{u.firstName} {u.lastName}</div>
                                        <div className="text-xs text-gray-400">{u.role === 'ClientUser' ? 'مشتری' : 'عضو تیم'}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default MessagesView;
