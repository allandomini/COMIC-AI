
import React, { useState, useRef, useEffect } from 'react';
import type { StoryPage, LetteringElement } from '../types';
import DownloadIcon from './icons/DownloadIcon';
import RefreshIcon from './icons/RefreshIcon';
import EditIcon from './icons/EditIcon';
import EditPanelModal from './EditPanelModal';
import PdfIcon from './icons/PdfIcon';
import ImageIcon from './icons/ImageIcon';
import LetteringLayer from './LetteringLayer';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

// Since JSZip & jsPDF are loaded from script tags, we declare them globally for TypeScript
declare var JSZip: any;
declare var jspdf: any;
declare var html2canvas: any;

interface StoryDisplayProps {
  pages: StoryPage[];
  onBackToDashboard: () => void;
  onBack: () => void;
  onRegenerate: (pageIndex: number) => void;
  onEdit: (pageIndex: number, editPrompt: string) => void;
  onUpdateLetteringElement: (pageIndex: number, elementId: string, updates: Partial<LetteringElement>) => void;
  onAddLetteringElement: (pageIndex: number, type: LetteringElement['type']) => void;
  onDeleteLetteringElement: (pageIndex: number, elementId: string) => void;
  onReorderPages: (dragIndex: number, dropIndex: number) => void;
}

const getPanelLayoutClasses = (layout?: StoryPage['layout']): string => {
  switch (layout) {
    case 'wide':
      return 'md:col-span-4 lg:col-span-4 aspect-video';
    case 'tall':
      return 'md:col-span-2 lg:col-span-2 md:row-span-2 aspect-[3/4]';
    case 'splash':
      return 'md:col-span-4 lg:col-span-6 md:row-span-2 aspect-video';
    case 'standard':
    default:
      return 'md:col-span-2 lg:col-span-2 aspect-[1/1]';
  }
};


const StoryDisplay: React.FC<StoryDisplayProps> = ({ pages, onBackToDashboard, onBack, onRegenerate, onEdit, onUpdateLetteringElement, onAddLetteringElement, onDeleteLetteringElement, onReorderPages }) => {
  const [editingPanelIndex, setEditingPanelIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);


  useEffect(() => {
    panelRefs.current = panelRefs.current.slice(0, pages.length);
  }, [pages]);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderPages(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };
  
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDownloadComic = async () => {
    if (typeof JSZip === 'undefined') {
      alert('Could not find the zipping library. Please try again later.');
      return;
    }
    setIsExporting('zip');

    const zip = new JSZip();
    let storyTextContent = "My Comic Story\n\n";

    for (const page of pages) {
      if (page.image) {
        const base64Data = page.image.split(',')[1];
        zip.file(`panel_${page.page}.png`, base64Data, { base64: true });
      }
      storyTextContent += `--- Panel ${page.page} ---\n`;
      if (page.narration) storyTextContent += `Narration: ${page.narration}\n`;
      if (page.dialogue?.length > 0) {
        page.dialogue.forEach(d => {
          storyTextContent += `${d.character}: ${d.line}\n`;
        });
      }
      storyTextContent += "\n";
    }
    zip.file("story.txt", storyTextContent);

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'comic.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to generate zip file:", error);
      alert("An error occurred while creating the zip file.");
    } finally {
        setIsExporting(null);
    }
  };

  const handleExportAsPdf = async () => {
    if (typeof jspdf === 'undefined') {
        alert('Could not find the PDF generation library. Please try again later.');
        return;
    }
    setIsExporting('pdf');
    try {
        const { jsPDF } = jspdf;
        // Using A4 portrait for a standard comic script look
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
        const margin = 10;
        const docWidth = doc.internal.pageSize.getWidth();
        const docHeight = doc.internal.pageSize.getHeight();
        const usableWidth = docWidth - margin * 2;
        let currentY = margin;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageContentHeight = calculatePageContentHeight(doc, page, usableWidth);
            
            if (i > 0 && currentY + pageContentHeight > docHeight - margin) {
                doc.addPage();
                currentY = margin;
            } else if (i > 0) {
                currentY += 10; // Add spacing between panels on the same page
                doc.line(margin, currentY, docWidth - margin, currentY); // Separator line
                currentY += 10;
            }

            // --- 1. Add Panel Image ---
            let imageBottomY = currentY;
            if (page.image) {
                const img = new Image();
                img.src = page.image;
                await new Promise(resolve => { img.onload = resolve });

                const ratio = img.width / img.height;
                let pdfImgWidth = usableWidth;
                let pdfImgHeight = pdfImgWidth / ratio;
                
                const maxImgHeight = docHeight * 0.4; 
                if (pdfImgHeight > maxImgHeight) {
                    pdfImgHeight = maxImgHeight;
                    pdfImgWidth = pdfImgHeight * ratio;
                }
                
                const x = (docWidth - pdfImgWidth) / 2;
                
                doc.addImage(page.image, 'PNG', x, currentY, pdfImgWidth, pdfImgHeight);
                imageBottomY = currentY + pdfImgHeight;
            }

            // --- 2. Add Story Text Below Image ---
            let textY = imageBottomY + 8;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`Panel ${page.page}`, margin, textY);
            textY += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            if (page.narration) {
                doc.setFont('helvetica', 'italic');
                const narrationLines = doc.splitTextToSize(`Narration: ${page.narration}`, usableWidth);
                doc.text(narrationLines, margin, textY);
                textY += (narrationLines.length * 5) + 3;
                doc.setFont('helvetica', 'normal');
            }

            if (page.dialogue && page.dialogue.length > 0) {
                page.dialogue.forEach(d => {
                    const dialogueText = `${d.character.toUpperCase()}: "${d.line}"`;
                    const dialogueLines = doc.splitTextToSize(dialogueText, usableWidth);
                    doc.text(dialogueLines, margin, textY);
                    textY += (dialogueLines.length * 5) + 2;
                });
            }
            currentY = textY;
        }
        doc.save('comic_script.pdf');
    } catch (error) {
        console.error("Failed to generate PDF file:", error);
        alert("An error occurred while creating the PDF file.");
    } finally {
        setIsExporting(null);
    }
  };

  // Helper function to estimate PDF content height to manage page breaks
  const calculatePageContentHeight = (doc: any, page: StoryPage, usableWidth: number): number => {
    let height = 0;
    if (page.image) {
        // This is a rough estimation. For simplicity, let's assume a max height.
        height += 80; // Estimate image height in mm
    }
    height += 15; // Panel title and spacing

    doc.setFontSize(10);
    if (page.narration) {
        const lines = doc.splitTextToSize(`Narration: ${page.narration}`, usableWidth);
        height += (lines.length * 5) + 3;
    }
    if (page.dialogue) {
        page.dialogue.forEach(d => {
            const lines = doc.splitTextToSize(`${d.character.toUpperCase()}: "${d.line}"`, usableWidth);
            height += (lines.length * 5) + 2;
        });
    }
    return height;
  }

  const handleExportAsWebtoon = async () => {
    if (typeof html2canvas === 'undefined') {
        alert('Could not find the rendering library. Please try again later.');
        return;
    }
    setIsExporting('webtoon');
    
    const uiElements = document.querySelectorAll('.interactive-ui-handle');
    uiElements.forEach(el => (el as HTMLElement).style.visibility = 'hidden');

    try {
        // Step 1: Identify valid panels to be exported by filtering out failures.
        const validPanelIndices = pages.reduce((acc, page, index) => {
            if (page.image && !page.generationFailed) {
                acc.push(index);
            }
            return acc;
        }, [] as number[]);

        // Step 2: Get the corresponding DOM elements for the valid panels.
        const panelElements = validPanelIndices
            .map(index => panelRefs.current[index])
            .filter(Boolean) as HTMLDivElement[];

        if (panelElements.length === 0) {
            alert("No valid comic panels with images were found to export.");
            return; 
        }

        // Step 3: Render each valid panel to an in-memory canvas.
        const canvasPromises = panelElements.map(panelEl =>
            html2canvas(panelEl, {
                useCORS: true,
                backgroundColor: null,
                scale: 2, // Render at higher resolution for better quality
            }).catch(err => {
                console.error("html2canvas failed for a panel:", err);
                return null;
            })
        );

        const canvases = (await Promise.all(canvasPromises)).filter(Boolean) as HTMLCanvasElement[];

        if (canvases.length === 0) {
            alert("Could not render any panels for export. Please try again.");
            return;
        }
        
        // Step 4: Validate rendered canvases and calculate dimensions for the final combined image.
        const validCanvases = canvases.filter(c => c.width > 0 && c.height > 0);
        if (validCanvases.length === 0) {
             alert("Rendered panels were empty. Cannot create Webtoon file.");
             return;
        }

        const padding = 20; // Vertical padding between panels in pixels
        // All panels will be scaled to a consistent width (the widest one).
        const finalWidth = Math.max(...validCanvases.map(c => c.width));

        // Calculate the scaled height for each panel to maintain its aspect ratio.
        const scaledPanels = validCanvases.map(canvas => {
            const scale = finalWidth / canvas.width;
            const scaledHeight = canvas.height * scale;
            return { canvas, scaledHeight };
        });

        // Calculate the total height of the final canvas including padding.
        const totalHeight = scaledPanels.reduce((sum, p) => sum + p.scaledHeight, 0) + (padding * (validCanvases.length > 1 ? validCanvases.length - 1 : 0));
        
        // Step 5: Create the main canvas and combine all the rendered panel images.
        const mainCanvas = document.createElement('canvas');
        mainCanvas.width = finalWidth;
        mainCanvas.height = totalHeight;
        const ctx = mainCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context.');

        // Fill background color.
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

        // Draw each scaled panel onto the main canvas.
        let currentY = 0;
        for (const panel of scaledPanels) {
            ctx.drawImage(panel.canvas, 0, currentY, finalWidth, panel.scaledHeight);
            currentY += panel.scaledHeight + padding;
        }
        
        // Step 6: Export the final combined image.
        const dataUrl = mainCanvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'comic_webtoon.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Failed to generate Webtoon file:", error);
        alert("An error occurred while creating the Webtoon file.");
    } finally {
        setIsExporting(null);
        uiElements.forEach(el => (el as HTMLElement).style.visibility = 'visible');
    }
  };

  const handleOpenEditModal = (index: number) => setEditingPanelIndex(index);
  const handleCloseEditModal = () => setEditingPanelIndex(null);
  const handleSaveEdit = (prompt: string) => {
    if (editingPanelIndex !== null) {
      onEdit(editingPanelIndex, prompt);
      handleCloseEditModal();
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <h2 className="font-bangers text-5xl text-center header-gradient mb-2">Your Comic is Ready!</h2>
      <p className="text-center text-slate-400 mb-8">You can drag and drop panels to reorder them.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 [grid-auto-flow:dense]">
        {pages.map((page, index) => {
          const layoutClasses = getPanelLayoutClasses(page.layout);
          const isDragging = draggedIndex === index;
          const isDropTarget = dropTargetIndex === index;
          const panelClasses = `
            bg-slate-800 rounded-lg shadow-2xl overflow-hidden border-4 border-slate-700 flex flex-col group 
            transform transition-all duration-300
            ${layoutClasses}
            ${isDragging ? 'panel-dragging' : 'hover:scale-[1.02]'}
            ${isDropTarget ? 'panel-drop-target' : ''}
          `;
          return (
            <div 
                key={page.page} 
                ref={el => { panelRefs.current[index] = el; }}
                className={panelClasses}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
            >
              <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                {page.generationFailed ? (
                   <div className="p-4 text-center flex flex-col items-center justify-center gap-2">
                     <ExclamationTriangleIcon className="w-12 h-12 text-red-500" />
                     <p className="font-bold text-red-400">Panel Generation Failed</p>
                     <p className="text-xs text-slate-400 max-w-xs">{page.failureReason}</p>
                     <button
                         onClick={() => onRegenerate(index)}
                         className="mt-2 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                     >
                         <RefreshIcon className="w-5 h-5" /> Regenerate
                     </button>
                   </div>
                ) : (page.isGenerating || (!page.image && !page.generationFailed)) ? (
                  <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                      <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-300 font-semibold">Generating...</span>
                  </div>
                ) : (
                  <>
                    {page.image && <img src={page.image} alt={`Page ${page.page}`} className="w-full h-full object-cover"/>}
                    {page.lettering && page.lettering.length > 0 && (
                      <LetteringLayer
                        lettering={page.lettering}
                        onUpdate={(elementId, updates) => onUpdateLetteringElement(index, elementId, updates)}
                        onAdd={(type) => onAddLetteringElement(index, type)}
                        onDelete={(elementId) => onDeleteLetteringElement(index, elementId)}
                      />
                    )}
                  </>
                )}

                {page.isLettering && (
                  <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                      <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-300 font-semibold">Placing Text...</span>
                  </div>
                )}

                {!page.isGenerating && !page.isLettering && page.image && !page.generationFailed && (
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                      <button 
                          onClick={() => onRegenerate(index)}
                          className="bg-slate-900 bg-opacity-50 text-white rounded-full p-2 transition-all duration-300 hover:bg-opacity-75 hover:scale-110"
                          title="Regenerate this panel"
                      >
                          <RefreshIcon className="w-5 h-5" />
                      </button>
                      <button 
                          onClick={() => handleOpenEditModal(index)}
                          className="bg-slate-900 bg-opacity-50 text-white rounded-full p-2 transition-all duration-300 hover:bg-opacity-75 hover:scale-110"
                          title="Edit this panel"
                      >
                          <EditIcon className="w-5 h-5" />
                      </button>
                  </div>
                )}
              </div>
              <div className="bg-slate-900 text-yellow-400 font-bangers text-2xl text-center py-1 mt-auto border-t-4 border-slate-700">
                  Panel {page.page}
              </div>
            </div>
          );
        })}
      </div>
      
      {editingPanelIndex !== null && pages[editingPanelIndex] && (
        <EditPanelModal
          page={pages[editingPanelIndex]}
          onClose={handleCloseEditModal}
          onSave={handleSaveEdit}
        />
      )}

      <div className="flex flex-col items-center gap-10 mt-12">
        <div className="flex flex-wrap justify-center gap-4">
          <button 
            onClick={handleDownloadComic} 
            disabled={!!isExporting}
            className="font-bangers text-2xl tracking-wider flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:bg-slate-500 disabled:cursor-wait"
          >
            {isExporting === 'zip' ? 'Zipping...' : <><DownloadIcon className="w-6 h-6" /> Export .Zip</>}
          </button>
          <button 
            onClick={handleExportAsPdf} 
            disabled={!!isExporting}
            className="font-bangers text-2xl tracking-wider flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:bg-slate-500 disabled:cursor-wait"
          >
            {isExporting === 'pdf' ? 'Creating PDF...' : <><PdfIcon className="w-6 h-6" /> Export PDF Script</>}
          </button>
          <button 
            onClick={handleExportAsWebtoon} 
            disabled={!!isExporting}
            className="font-bangers text-2xl tracking-wider flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:bg-slate-500 disabled:cursor-wait"
          >
            {isExporting === 'webtoon' ? 'Rendering Image...' : <><ImageIcon className="w-6 h-6" /> Export Webtoon</>}
          </button>
        </div>
        <div className="flex justify-center items-center flex-wrap gap-4">
          <button onClick={onBack} className="font-bangers text-2xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">
              Back
          </button>
          <button onClick={onBackToDashboard} className="font-bangers text-3xl tracking-wider bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-10 rounded-lg transition-transform transform hover:scale-105">
            Back to Projects
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryDisplay;
