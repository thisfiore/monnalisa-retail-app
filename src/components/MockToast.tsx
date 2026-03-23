import { useMockToast } from '../lib/mock-toast-context';

export function MockToast() {
  const { mockCalls, removeMockCall } = useMockToast();

  if (mockCalls.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {mockCalls.map((call) => (
        <div
          key={call.id}
          className="flex items-center gap-2 bg-white border border-orange-300 rounded-lg shadow-lg px-3 py-2 animate-slide-in"
          onClick={() => removeMockCall(call.id)}
        >
          <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">
            MOCK
          </span>
          <span className="text-sm text-gray-700 font-mono">{call.path}</span>
        </div>
      ))}
    </div>
  );
}
