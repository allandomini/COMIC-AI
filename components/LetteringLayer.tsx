import React, { useState, useRef, useEffect } from 'react';
import type { LetteringElement } from '../types';
import TrashIcon from './icons/TrashIcon';

interface LetteringLayerProps {
  lettering: LetteringElement[] | null | undefined;
  onUpdate: (elementId: string, updates: Partial<LetteringElement>) => void;
  onAdd: (type: LetteringElement['type']) => void;
  onDelete: (elementId: string) => void;
}

const comicFonts = ['Inter', 'Bangers', 'Comic Neue', 'Luckiest Guy', 'Creepster'];

const LetteringLayer: React.FC<LetteringLayerProps> = ({ lettering, onUpdate, onAdd, onDelete }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [interaction, setInteraction] = useState<{ id: string; type: 'move' | 'resize' | 'tail'; initialX: number; initialY: number; initialElement: LetteringElement } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const balloonRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    // This dummy state forces a re-render after the refs have been populated,
    // so the SVG tails can be drawn using the correct, measured balloon heights.
    const [, setRenderTrigger] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setRenderTrigger(v => v + 1), 0);
        return () => clearTimeout(timer);
    }, [lettering]);

    const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize' | 'tail') => {
        // Prevent interaction when editing text
        if (editingTextId) return;
        
        e.preventDefault();
        e.stopPropagation();
        const element = lettering?.find(el => el.id === id);
        if (!element || !containerRef.current) return;
        
        setSelectedId(id);
        
        setInteraction({
            id,
            type,
            initialX: e.clientX,
            initialY: e.clientY,
            initialElement: element
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!interaction || !containerRef.current) return;
        
        const { id, type, initialX, initialY, initialElement } = interaction;
        const containerRect = containerRef.current.getBoundingClientRect();

        const dx = (e.clientX - initialX) / containerRect.width * 100;
        const dy = (e.clientY - initialY) / containerRect.height * 100;

        if (type === 'move') {
            onUpdate(id, { x: initialElement.x + dx, y: initialElement.y + dy });
        } else if (type === 'resize') {
            onUpdate(id, { width: Math.max(10, initialElement.width + dx), height: Math.max(10, initialElement.height + dy) });
        } else if (type === 'tail' && initialElement.tail) {
            onUpdate(id, { tail: { x: initialElement.tail.x + dx, y: initialElement.tail.y + dy } });
        }
    };

    const handleMouseUp = () => {
        setInteraction(null);
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = () => handleMouseUp();
    
        if (interaction) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [interaction, onUpdate]);

    const handleDoubleClick = (e: React.MouseEvent, element: LetteringElement) => {
        e.stopPropagation();
        setSelectedId(element.id);
        setEditingTextId(element.id);
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!editingTextId) return;
        onUpdate(editingTextId, { text: e.target.value });
    };

    const handleTextareaBlur = () => {
        setEditingTextId(null);
    };
    
    // Auto-focus and select text when textarea appears
    useEffect(() => {
        if (editingTextId && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [editingTextId]);

    const getBalloonClasses = (el: LetteringElement) => {
        const base = "absolute flex justify-center p-2 box-border transition-all duration-200";
        const cursor = editingTextId ? 'default' : 'cursor-move';
        const selected = selectedId === el.id ? "border-2 border-dashed border-cyan-400 z-20" : "border-2 border-black z-10";
        
        switch (el.type) {
            case 'narration':
                return `${base} ${selected} ${cursor} rounded-md`;
            case 'thought':
                return `${base} ${selected} ${cursor} rounded-full border-dashed`;
            case 'shout':
                 return `${base} ${selected} ${cursor} rounded-xl`;
            case 'dialogue':
            default:
                return `${base} ${selected} ${cursor} rounded-xl`;
        }
    };
    
    return (
        <div 
          ref={containerRef} 
          className="absolute inset-0 w-full h-full"
          onClick={() => setSelectedId(null)} // Deselect on container click
        >
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[15]" style={{ overflow: 'visible' }}>
                {lettering?.map(el => {
                    if (!el.tail || el.type === 'narration') return null;
                    
                    const balloonEl = balloonRefs.current.get(el.id);
                    const containerEl = containerRef.current;
                    
                    // Fallback to stored height if element isn't rendered yet
                    let fromY = el.y + el.height; 
                    if (balloonEl && containerEl) {
                        const containerRect = containerEl.getBoundingClientRect();
                        // Calculate the balloon's bottom edge in percentage of the container height
                        fromY = el.y + (balloonEl.offsetHeight / containerRect.height) * 100;
                    }

                    const fromX_center = el.x + el.width / 2;
                    const toX = el.tail.x;
                    const toY = el.tail.y;
                    
                    const tailBaseWidth = Math.min(el.width * 0.25, 8);

                    const pathData = `M ${fromX_center - tailBaseWidth},${fromY} Q ${fromX_center},${fromY + 5}, ${toX},${toY} Q ${fromX_center},${fromY + 5} ${fromX_center + tailBaseWidth},${fromY}`;

                    return (
                        <g key={`${el.id}-tail`}>
                            <path d={pathData} fill={el.fillColor} />
                            <path d={pathData} stroke="black" strokeWidth="2" fill="none" />
                        </g>
                    );
                })}
            </svg>
            
            {lettering?.map(element => (
                <div
                    key={element.id}
                    // FIX: The ref callback function must return void. Using a block body ensures no value is returned.
                    ref={node => { balloonRefs.current.set(element.id, node); }}
                    className={getBalloonClasses(element)}
                    style={{
                        left: `${element.x}%`,
                        top: `${element.y}%`,
                        width: `${element.width}%`,
                        height: 'auto',
                        minHeight: '40px',
                        backgroundColor: element.fillColor,
                        color: element.color,
                        fontFamily: `'${element.fontFamily}', sans-serif`,
                        fontSize: `${element.fontSize}vmin`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, element.id, 'move')}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(element.id); }}
                    onDoubleClick={(e) => handleDoubleClick(e, element)}
                >
                    {editingTextId === element.id ? (
                        <textarea
                            ref={textareaRef}
                            value={element.text}
                            onChange={handleTextareaChange}
                            onBlur={handleTextareaBlur}
                            className="w-full h-full bg-transparent border-none outline-none resize-none text-center"
                            style={{
                                fontWeight: element.fontWeight,
                                textAlign: element.textAlign,
                                color: 'inherit',
                                fontFamily: 'inherit',
                                fontSize: 'inherit',
                                letterSpacing: element.type === 'narration' ? '0.05em' : 'normal',
                            }}
                        />
                    ) : (
                        <p
                            className="w-full outline-none cursor-text overflow-hidden whitespace-pre-wrap"
                            style={{
                                textAlign: element.textAlign,
                                fontWeight: element.fontWeight,
                                letterSpacing: element.type === 'narration' ? '0.05em' : 'normal',
                            }}
                        >
                            {element.text}
                        </p>
                    )}
                    
                    {selectedId === element.id && !editingTextId && (
                        <>
                            <div
                                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-cyan-400 rounded-full cursor-se-resize border-2 border-white shadow-lg interactive-ui-handle"
                                onMouseDown={(e) => handleMouseDown(e, element.id, 'resize')}
                            />
                            <div 
                                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 rounded-lg p-1 flex items-center gap-1 shadow-xl z-30 interactive-ui-handle"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <select 
                                    value={element.type} 
                                    onChange={(e) => onUpdate(element.id, { type: e.target.value as any })}
                                    className="bg-slate-700 text-white text-xs rounded p-1 focus:outline-none"
                                >
                                    <option value="dialogue">Dialogue</option>
                                    <option value="thought">Thought</option>
                                    <option value="shout">Shout</option>
                                    <option value="narration">Narration</option>
                                </select>
                                <select
                                    value={element.fontFamily}
                                    onChange={(e) => onUpdate(element.id, { fontFamily: e.target.value })}
                                    className="bg-slate-700 text-white text-xs rounded p-1 focus:outline-none w-20"
                                >
                                    {comicFonts.map(font => <option key={font} value={font}>{font}</option>)}
                                </select>
                                <input
                                    type="number"
                                    value={element.fontSize}
                                    onChange={(e) => onUpdate(element.id, { fontSize: parseFloat(e.target.value) || 2 })}
                                    className="bg-slate-700 text-white text-xs rounded p-1 focus:outline-none w-12 text-center"
                                    step="0.1" min="0.5" max="10" title="Font Size (vmin)"
                                />
                                <div className="relative w-6 h-6" title="Text Color">
                                    <label htmlFor={`color-${element.id}`} className="block w-full h-full cursor-pointer rounded border border-slate-500" style={{backgroundColor: element.color}}></label>
                                    <input id={`color-${element.id}`} type="color" value={element.color} onChange={(e) => onUpdate(element.id, { color: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full" />
                                </div>
                                <div className="relative w-6 h-6" title="Balloon Color">
                                    <label htmlFor={`fill-${element.id}`} className="block w-full h-full cursor-pointer rounded border border-slate-500" style={{backgroundColor: element.fillColor}}></label>
                                    <input id={`fill-${element.id}`} type="color" value={element.fillColor} onChange={(e) => onUpdate(element.id, { fillColor: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full" />
                                </div>
                                <button onClick={() => onDelete(element.id)} className="p-1 text-white hover:bg-red-500 rounded">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ))}
            
            {lettering?.map(element => {
                if(selectedId === element.id && element.tail && !editingTextId){
                    return(
                         <div
                            key={`${element.id}-tail-handle`}
                            className="absolute w-4 h-4 bg-purple-500 rounded-full cursor-move border-2 border-white shadow-lg z-30 interactive-ui-handle"
                            style={{ left: `${element.tail.x}%`, top: `${element.tail.y}%`, transform: 'translate(-50%, -50%)'}}
                            onMouseDown={(e) => handleMouseDown(e, element.id, 'tail')}
                        />
                    )
                }
                return null;
            })}

            <div className="absolute bottom-4 right-4 bg-slate-900 rounded-lg p-2 flex items-center gap-2 shadow-xl z-30 interactive-ui-handle">
                <span className="text-white font-bold text-sm px-1">Add:</span>
                <button onClick={(e) => { e.stopPropagation(); onAdd('dialogue'); }} className="h-8 w-8 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-full" title="Add Dialogue">D</button>
                <button onClick={(e) => { e.stopPropagation(); onAdd('thought'); }} className="h-8 w-8 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-full" title="Add Thought">T</button>
                <button onClick={(e) => { e.stopPropagation(); onAdd('narration'); }} className="h-8 w-8 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-full" title="Add Narration">N</button>
            </div>
        </div>
    );
};

export default LetteringLayer;