import { useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

export function AnnotationForm() {
  const [text, setText] = useState('');
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);

  const handleAdd = () => {
    if (!text.trim()) return;
    addAnnotation(text.trim());
    setText('');
  };

  return (
    <div className="flex flex-col h-full gap-0.5">
      <span className="text-[10px] font-medium text-gray-600">각주</span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="각주 입력"
        className="flex-1 w-full rounded border-gray-300 text-xs p-1 border resize-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="self-end px-2 py-0.5 bg-teal-600 text-white rounded text-[10px] hover:bg-teal-700"
      >
        추가
      </button>
    </div>
  );
}
