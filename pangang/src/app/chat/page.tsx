'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    stocks?: Stock[];
    timestamp: Date;
}

interface Stock {
    name: string;
    code: string;
    score: number;
    reason: string;
}

const initialMessages: Message[] = [
    {
        id: 1,
        role: 'assistant',
        content: '你好！我是盘感AI，可以帮你分析市场、验证投资想法。试试问我：\n\n• "今年锂电池会反转吗？"\n• "黄金现在还能买吗？"\n• "帮我分析一下贵州茅台"',
        timestamp: new Date(),
    },
];

// 模拟AI回复
const mockResponses: { [key: string]: { content: string; stocks?: Stock[] } } = {
    '新能源': {
        content: `**新能源汽车板块分析：**

📊 **估值**：当前PE 25倍，历史20%分位，处于较低水平

📈 **趋势**：
• 销量同比+35%，渗透率持续提升
• 出口增速超50%，欧洲市场打开
• 智能化加速，软件价值重估

⚠️ **风险**：
• 价格战压力持续
• 产能过剩隐忧
• 补贴退坡影响

💡 **AI观点**：中性偏多，建议关注龙头企业`,
        stocks: [
            { name: '比亚迪', code: '002594', score: 8.5, reason: '估值合理，出口逻辑' },
            { name: '宁德时代', code: '300750', score: 7.8, reason: '龙头地位，但估值较高' },
            { name: '长城汽车', code: '601633', score: 8.2, reason: '出海逻辑强，估值便宜' },
        ],
    },
    '黄金': {
        content: `**黄金分析：**

📊 **当前价格**：$2,015/盎司，接近历史高点

📈 **利多因素**：
• 美联储降息预期增强
• 地缘政治风险持续
• 央行持续增持

⚠️ **利空因素**：
• 短期涨幅较大，有回调压力
• 美元反弹可能

💡 **AI观点**：长期看多，短期建议等待回调再介入

建议关注点位：$1,980支撑位`,
    },
    '茅台': {
        content: `**贵州茅台 (600519) 分析：**

📊 **核心数据**：
• 股价：1,856元
• PE(TTM)：28.5倍
• 市值：2.3万亿
• 股息率：1.8%

📈 **2023年报要点**：
• 营收1,505亿，同比+19.2%
• 净利润747亿，同比+17.4%
• 直销渠道占比提升至45%

⚠️ **风险提示**：
• 增速边际放缓
• 消费复苏不及预期

💡 **AI观点**：估值处于历史中位，长期持有价值较高`,
        stocks: [
            { name: '贵州茅台', code: '600519', score: 8.0, reason: '业绩稳健，长期价值' },
        ],
    },
    'default': {
        content: `感谢你的问题！让我来分析一下...

基于当前市场情况：

📊 **市场概况**：市场整体情绪谨慎偏多，结构性机会明显

💡 **建议**：
1. 关注政策催化板块
2. 重视估值安全边际
3. 分批建仓，控制仓位

如果你想深入了解某个具体板块或个股，可以告诉我详细需求。`,
    },
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // 模拟AI响应延迟
        setTimeout(() => {
            let response = mockResponses['default'];

            if (input.includes('新能源') || input.includes('电车') || input.includes('汽车')) {
                response = mockResponses['新能源'];
            } else if (input.includes('黄金') || input.includes('贵金属')) {
                response = mockResponses['黄金'];
            } else if (input.includes('茅台') || input.includes('白酒')) {
                response = mockResponses['茅台'];
            }

            const aiMessage: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.content,
                stocks: response.stocks,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);
            setIsLoading(false);
        }, 1500);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
            {/* 顶部导航 */}
            <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            <ArrowLeftIcon />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-green)]/20 flex items-center justify-center">
                                <SparkleIcon className="w-4 h-4 text-[var(--accent-green)]" />
                            </div>
                            <span className="font-medium">AI盘感</span>
                        </div>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                        随时验证你的想法
                    </div>
                </div>
            </header>

            {/* 消息列表 */}
            <main className="flex-1 overflow-y-auto pb-24">
                <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
                    {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}

                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-green)]/20 flex items-center justify-center flex-shrink-0">
                                <SparkleIcon className="w-4 h-4 text-[var(--accent-green)]" />
                            </div>
                            <div className="card py-3 px-4">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-[var(--accent-green)] rounded-full animate-pulse" />
                                    <span className="w-2 h-2 bg-[var(--accent-green)] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                    <span className="w-2 h-2 bg-[var(--accent-green)] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* 输入框 */}
            <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)]/95 backdrop-blur-md border-t border-[var(--border-color)]">
                <div className="max-w-3xl mx-auto px-4 py-3">
                    <div className="flex items-end gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="输入你的问题或想法..."
                            className="input flex-1 resize-none min-h-[44px] max-h-[120px]"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="btn btn-primary px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SendIcon />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
                        <QuickTag onClick={() => setInput('帮我分析一下新能源汽车板块')}>新能源</QuickTag>
                        <QuickTag onClick={() => setInput('黄金现在还能买吗？')}>黄金</QuickTag>
                        <QuickTag onClick={() => setInput('帮我分析一下贵州茅台')}>茅台</QuickTag>
                        <QuickTag onClick={() => setInput('今天市场怎么样？')}>今日市场</QuickTag>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-[var(--bg-card)]' : 'bg-[var(--accent-green)]/20'
                }`}>
                {isUser ? (
                    <UserIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                ) : (
                    <SparkleIcon className="w-4 h-4 text-[var(--accent-green)]" />
                )}
            </div>
            <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                <div className={`card py-3 px-4 ${isUser ? 'bg-[var(--accent-green)] text-black' : ''}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                </div>

                {/* 推荐股票列表 */}
                {message.stocks && message.stocks.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-sm text-[var(--text-secondary)]">推荐关注（按性价比排序）：</p>
                        {message.stocks.map((stock) => (
                            <Link
                                key={stock.code}
                                href={`/stock/${stock.code}`}
                                className="card py-2 px-3 flex items-center justify-between hover:border-[var(--accent-green)] transition-all"
                            >
                                <div>
                                    <span className="font-medium">{stock.name}</span>
                                    <span className="text-[var(--text-muted)] text-sm ml-2">{stock.code}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-[var(--text-secondary)]">{stock.reason}</span>
                                    <span className="score text-sm">⭐ {stock.score}</span>
                                </div>
                            </Link>
                        ))}
                        <div className="flex gap-2 mt-2">
                            <button className="btn btn-secondary text-sm py-2 px-3">
                                加入追踪
                            </button>
                        </div>
                    </div>
                )}

                <span className="text-xs text-[var(--text-muted)] mt-1 block">
                    {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

// 快捷标签
function QuickTag({ children, onClick }: { children: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="tag hover:border-[var(--accent-green)] hover:text-[var(--accent-green)] transition-all whitespace-nowrap">
            {children}
        </button>
    );
}

// Icons
function ArrowLeftIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    );
}

function SparkleIcon({ className = '' }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
    );
}

function UserIcon({ className = '' }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
    );
}
