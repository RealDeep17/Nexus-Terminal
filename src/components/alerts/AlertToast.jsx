import React from 'react';
import toast from 'react-hot-toast';

export default function AlertToast({ alert, t }) {
    return (
        <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
            max-w-md w-full bg-[#1e222d] shadow-2xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-[#2962ff]`}
        >
            <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                        <span className="w-8 h-8 rounded-full bg-[#2962ff]/20 text-[#2962ff] flex items-center justify-center font-bold text-xs ring-2 ring-[#131722]">
                            🔔
                        </span>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-bold text-white uppercase tracking-wider">
                            {alert.symbol} Alert
                        </p>
                        <p className="mt-1 text-sm text-gray-300">
                            {alert.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 font-mono">
                            Price at trigger: <span className="text-[#2962ff] font-bold">{parseFloat(alert.priceAtFire).toFixed(2)}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex border-l border-gray-700">
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#2962ff]"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
