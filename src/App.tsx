/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Stage, 
  Layer, 
  Image as KonvaImage, 
  Rect, 
  Line, 
  Arrow, 
  Text as KonvaText,
  Group
} from 'react-konva';
import useImage from 'use-image';
import { 
  FileUp, 
  Move, 
  Lock, 
  Unlock, 
  Square, 
  Minus, 
  ArrowRight, 
  Type, 
  Cloud, 
  Download, 
  Plus, 
  FolderOpen, 
  Save, 
  X, 
  Info,
  ChevronDown,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react';
import { renderPdfPageToDataUrl, tintImage } from './utils/pdf';
import { Annotation, ShapeType, CompareProject } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // Project State
  const [v1DataUrl, setV1DataUrl] = useState<string | null>(null);
  const [v2DataUrl, setV2DataUrl] = useState<string | null>(null);
  const [v1Tinted, setV1Tinted] = useState<string | null>(null);
  const [v2Tinted, setV2Tinted] = useState<string | null>(null);
  const [v1FileName, setV1FileName] = useState<string | null>(null);
  const [v2FileName, setV2FileName] = useState<string | null>(null);
  
  const [v1Visible, setV1Visible] = useState(true);
  const [v2Visible, setV2Visible] = useState(true);
  const [v2Offset, setV2Offset] = useState({ x: 0, y: 0 });
  const [isMoveLocked, setIsMoveLocked] = useState(false);
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  
  // UI State
  const [activeTool, setActiveTool] = useState<'move' | ShapeType | null>(null);
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState({ x: 0, y: 0 });
  const [showLogo, setShowLogo] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [dragOverV1, setDragOverV1] = useState(false);
  const [dragOverV2, setDragOverV2] = useState(false);
  
  // Refs
  const stageRef = useRef<any>(null);
  const fileInputV1 = useRef<HTMLInputElement>(null);
  const fileInputV2 = useRef<HTMLInputElement>(null);
  const fileInputProject = useRef<HTMLInputElement>(null);

  // Images
  const [v1Img, v1Status] = useImage(v1Tinted || '');
  const [v2Img, v2Status] = useImage(v2Tinted || '');

  useEffect(() => {
    console.log('V1 Image Status:', v1Status);
    if (v1Img) console.log('V1 Image Loaded:', v1Img.width, 'x', v1Img.height);
  }, [v1Img, v1Status]);

  useEffect(() => {
    console.log('V2 Image Status:', v2Status);
    if (v2Img) console.log('V2 Image Loaded:', v2Img.width, 'x', v2Img.height);
  }, [v2Img, v2Status]);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 48 });

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight - 48 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if ((v1Img || v2Img) && zoom === 1 && stagePos.x === 0 && stagePos.y === 0) {
      handleFitToScreen();
    }
  }, [v1Img, v2Img]);

  useEffect(() => {
    if (showLogo) {
      const timer = setTimeout(() => setShowLogo(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showLogo]);

  // Handle PDF Uploads
  const processFile = async (file: File, version: 'V1' | 'V2') => {
    setIsLoading(true);
    console.log(`Processing ${version}:`, file.name);
    try {
      if (version === 'V1') {
        setV1FileName(file.name);
        const dataUrl = await renderPdfPageToDataUrl(file);
        setV1DataUrl(dataUrl);
        const tinted = await tintImage(dataUrl, 'red');
        setV1Tinted(tinted);
      } else {
        setV2FileName(file.name);
        const dataUrl = await renderPdfPageToDataUrl(file);
        setV2DataUrl(dataUrl);
        const tinted = await tintImage(dataUrl, 'blue');
        setV2Tinted(tinted);
      }
      if (isComparing) setIsComparing(false);
    } catch (err) {
      console.error(`${version} Upload failed:`, err);
      alert(`Failed to load PDF ${version}. Please check the console for details.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadV1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, 'V1');
    if (e.target) e.target.value = '';
  };

  const handleUploadV2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, 'V2');
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent, version: 'V1' | 'V2') => {
    e.preventDefault();
    if (version === 'V1') setDragOverV1(false);
    else setDragOverV2(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      processFile(file, version);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  // Zoom handling
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    setZoom(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // Drawing Logic
  const [newAnnotation, setNewAnnotation] = useState<Annotation | null>(null);

  const handleMouseDown = (e: any) => {
    // Middle mouse button (button 1) for panning
    if (e.evt.button === 1) {
      setIsPanning(true);
      setLastPointerPos(stageRef.current.getPointerPosition());
      return;
    }

    if (!activeTool || activeTool === 'move') return;
    
    const stage = stageRef.current;
    const pos = stage.getPointerPosition();
    const scale = stage.scaleX();
    const x = (pos.x - stage.x()) / scale;
    const y = (pos.y - stage.y()) / scale;

    const id = Math.random().toString(36).substring(7);
    
    if (activeTool === 'text') {
      // Use a timeout to avoid interrupting the event loop
      setTimeout(() => {
        const text = prompt('Enter text:');
        if (text) {
          setAnnotations(prev => [...prev, { id, type: 'text', x, y, text, color: drawColor }]);
        }
      }, 10);
      return;
    }

    setNewAnnotation({
      id,
      type: activeTool as ShapeType,
      x,
      y,
      points: [x, y],
      color: drawColor,
      width: 0,
      height: 0
    });
  };

  const handleMouseMove = (e: any) => {
    if (isPanning) {
      const stage = stageRef.current;
      const pos = stage.getPointerPosition();
      const dx = pos.x - lastPointerPos.x;
      const dy = pos.y - lastPointerPos.y;
      setStagePos(prev => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      setLastPointerPos(pos);
      return;
    }

    if (!newAnnotation) return;
    
    const stage = stageRef.current;
    const pos = stage.getPointerPosition();
    const scale = stage.scaleX();
    const x = (pos.x - stage.x()) / scale;
    const y = (pos.y - stage.y()) / scale;

    if (newAnnotation.type === 'box' || newAnnotation.type === 'cloud') {
      setNewAnnotation({
        ...newAnnotation,
        width: x - newAnnotation.x,
        height: y - newAnnotation.y
      });
    } else if (newAnnotation.type === 'line' || newAnnotation.type === 'arrow') {
      setNewAnnotation({
        ...newAnnotation,
        points: [newAnnotation.x, newAnnotation.y, x, y]
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (newAnnotation) {
      setAnnotations([...annotations, newAnnotation]);
      setNewAnnotation(null);
    }
  };

  // V2 Movement
  const handleV2Drag = (e: any) => {
    if (isMoveLocked) return;
    setV2Offset({ x: e.target.x(), y: e.target.y() });
  };

  // File Menu Actions
  const handleNew = () => {
    setShowLogo(true);
    setV1DataUrl(null);
    setV2DataUrl(null);
    setV1Tinted(null);
    setV2Tinted(null);
    setV1FileName(null);
    setV2FileName(null);
    setAnnotations([]);
    setV2Offset({ x: 0, y: 0 });
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
    setIsComparing(false);
  };

  const handleSaveJpg = () => {
    console.log('Attempting to save JPG...');
    const stage = stageRef.current;
    
    if (!isComparing) {
      alert('Please start the comparison (upload both PDFs and click Start Comparison) before saving a JPG.');
      return;
    }

    if (!stage) {
      alert('Comparison stage is not ready. Please try moving the view or zooming, then try again.');
      return;
    }
    
    const fileName = prompt('Enter filename for JPG:', v1FileName ? `${v1FileName.split('.')[0]}_compare` : 'compare-pdf');
    if (!fileName) return;

    setIsLoading(true);
    
    // Use a small timeout to allow the loading overlay to show
    setTimeout(() => {
      try {
        console.log('Generating DataURL...');
        // Use pixelRatio: 1 for maximum compatibility and speed
        const uri = stage.toDataURL({ 
          pixelRatio: 1,
          mimeType: 'image/jpeg',
          quality: 0.8
        });
        
        if (!uri || uri === 'data:,') {
          throw new Error('Generated image is empty');
        }

        console.log('Triggering download...');
        const link = document.createElement('a');
        link.download = `${fileName}.jpg`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup with delay
        setTimeout(() => {
          document.body.removeChild(link);
          setIsLoading(false);
        }, 100);
      } catch (err) {
        setIsLoading(false);
        console.error('Save JPG failed:', err);
        alert('Failed to save JPG. The comparison might be too large for your browser to process as a single image. Try zooming out or using a smaller window.');
      }
    }, 100);
  };

  const handleSaveProject = () => {
    console.log('Attempting to save project...');
    if (!v1DataUrl && !v2DataUrl) {
      alert('No project data to save. Please upload at least one PDF first.');
      return;
    }
    
    const fileName = prompt('Enter filename for Project:', v1FileName ? `${v1FileName.split('.')[0]}_project` : 'compare-project');
    if (!fileName) return;

    setIsLoading(true);
    
    setTimeout(() => {
      try {
        const project: CompareProject = {
          v1DataUrl,
          v2DataUrl,
          v1Tinted,
          v2Tinted,
          v1FileName,
          v2FileName,
          v2Offset,
          annotations,
          zoom
        };
        
        console.log('Stringifying project data...');
        const json = JSON.stringify(project);
        const blob = new Blob([json], { type: 'application/json' });
        
        console.log('Creating object URL...');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${fileName}.comp`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup with delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setIsLoading(false);
        }, 500);
      } catch (err) {
        setIsLoading(false);
        console.error('Save Project failed:', err);
        alert('Failed to save project file. The project data might be too large for the browser to handle as a single file.');
      }
    }, 100);
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const project: CompareProject = JSON.parse(event.target?.result as string);
      setV1DataUrl(project.v1DataUrl);
      setV2DataUrl(project.v2DataUrl);
      setV1Tinted(project.v1Tinted);
      setV2Tinted(project.v2Tinted);
      setV1FileName(project.v1FileName || null);
      setV2FileName(project.v2FileName || null);
      setV2Offset(project.v2Offset);
      setAnnotations(project.annotations);
      setZoom(project.zoom);
      setIsComparing(true);
    };
    reader.readAsText(file);
  };

  const handleExit = () => {
    if (confirm('Are you sure you want to exit? Any unsaved changes will be lost.')) {
      setIsExiting(true);
      setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
      }, 4000);
    }
  };

  const handleFitToScreen = () => {
    if (!v1Img && !v2Img) return;
    const imgWidth = v1Img?.width || v2Img?.width || 800;
    const imgHeight = v1Img?.height || v2Img?.height || 1100;
    
    const padding = 40;
    const scaleX = (stageSize.width - padding * 2) / imgWidth;
    const scaleY = (stageSize.height - padding * 2) / imgHeight;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setZoom(newScale);
    setStagePos({
      x: (stageSize.width - imgWidth * newScale) / 2,
      y: (stageSize.height - imgHeight * newScale) / 2,
    });
  };

  // Render Cloud Shape (Simplified as a bumpy rect)
  const renderCloud = (ann: Annotation) => {
    const { x, y, width = 0, height = 0, color } = ann;
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={color}
        strokeWidth={4}
        dash={[10, 5]} // Cloud-like dash
        cornerRadius={10}
      />
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#f0f0f0] font-sans text-gray-900 overflow-hidden">
      {/* Top Menu Bar */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-6 z-50">
        <div className="flex items-center gap-2 font-bold text-indigo-600">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white">
            <FileUp size={18} />
          </div>
          CompPDF
        </div>

        <div className="flex gap-4">
          {/* File Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(isMenuOpen === 'file' ? null : 'file')}
              className="px-3 py-1 hover:bg-gray-100 rounded flex items-center gap-1 text-sm font-medium"
            >
              File <ChevronDown size={14} />
            </button>
            {isMenuOpen === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50">
                <button onClick={() => { handleNew(); setIsMenuOpen(null); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-center gap-3 text-sm">
                  <Plus size={16} /> New Compare PDF
                </button>
                <button onClick={() => { fileInputProject.current?.click(); setIsMenuOpen(null); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-center gap-3 text-sm">
                  <FolderOpen size={16} /> Open Existing Compare PDF
                </button>
                <button onClick={() => { handleSaveProject(); setIsMenuOpen(null); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-center gap-3 text-sm">
                  <Save size={16} /> Save Project (.comp)
                </button>
                <button onClick={() => { handleSaveJpg(); setIsMenuOpen(null); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-center gap-3 text-sm">
                  <Download size={16} /> Save current status to JPG
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button onClick={handleExit} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-3 text-sm">
                  <X size={16} /> Exit Application
                </button>
              </div>
            )}
          </div>

          {/* About Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(isMenuOpen === 'about' ? null : 'about')}
              className="px-3 py-1 hover:bg-gray-100 rounded flex items-center gap-1 text-sm font-medium"
            >
              About <ChevronDown size={14} />
            </button>
            {isMenuOpen === 'about' && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={18} className="text-indigo-600" />
                  <span className="font-bold">CompPDF v1.0</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  A professional PDF comparison tool designed for precise overlay and annotation.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Developed By</p>
                  <p className="text-sm font-medium">SriGaneshBabu</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 relative overflow-hidden bg-[#e5e5e5]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-indigo-600">Processing PDF...</p>
            </div>
          </div>
        )}

        {/* Logo/Exit Video Overlay */}
        {(showLogo || isExiting) && (
          <div className="absolute inset-0 bg-black z-[200] flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              <video 
                autoPlay 
                muted 
                loop={!isExiting}
                className="max-w-full max-h-full object-contain"
              >
                <source src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <div className="absolute bottom-12 text-white text-center">
                <h2 className="text-4xl font-bold tracking-tighter mb-2">CompPDF</h2>
                <p className="text-gray-400 uppercase tracking-widest text-sm">
                  {isExiting ? 'Exiting Application...' : 'Welcome to Professional Comparison'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State / Uploaders / Previews */}
        {!isComparing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#e5e5e5] p-8">
            <div className="grid grid-cols-2 gap-8 max-w-5xl w-full flex-1">
              {/* V1 Upload/Preview */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center">
                  <h3 className="font-bold text-red-600 uppercase tracking-wider text-sm">Base PDF (V1)</h3>
                  {v1FileName && <p className="text-[10px] text-gray-500 font-medium truncate max-w-full">{v1FileName}</p>}
                </div>
                <div 
                  onClick={() => fileInputV1.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverV1(true); }}
                  onDragLeave={() => setDragOverV1(false)}
                  onDrop={(e) => handleDrop(e, 'V1')}
                  className={cn(
                    "flex-1 bg-white rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group overflow-hidden relative",
                    v1DataUrl ? "border-red-200" : "border-gray-300 hover:border-red-500 hover:bg-red-50",
                    dragOverV1 && "border-red-500 bg-red-50 scale-[1.02]"
                  )}
                >
                  {v1DataUrl ? (
                    <>
                      <img src={v1DataUrl} alt="V1 Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={24} className="text-red-600" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileUp size={32} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Upload Base PDF</h3>
                      <p className="text-sm text-gray-500">Click or Drag & Drop PDF</p>
                    </>
                  )}
                </div>
              </div>

              {/* V2 Upload/Preview */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center">
                  <h3 className="font-bold text-blue-600 uppercase tracking-wider text-sm">Target PDF (V2)</h3>
                  {v2FileName && <p className="text-[10px] text-gray-500 font-medium truncate max-w-full">{v2FileName}</p>}
                </div>
                <div 
                  onClick={() => fileInputV2.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverV2(true); }}
                  onDragLeave={() => setDragOverV2(false)}
                  onDrop={(e) => handleDrop(e, 'V2')}
                  className={cn(
                    "flex-1 bg-white rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group overflow-hidden relative",
                    v2DataUrl ? "border-blue-200" : "border-gray-300 hover:border-blue-500 hover:bg-blue-50",
                    dragOverV2 && "border-blue-500 bg-blue-50 scale-[1.02]"
                  )}
                >
                  {v2DataUrl ? (
                    <>
                      <img src={v2DataUrl} alt="V2 Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={24} className="text-blue-600" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileUp size={32} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Upload Target PDF</h3>
                      <p className="text-sm text-gray-500">Click or Drag & Drop PDF</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Compare Button */}
            {v1DataUrl && v2DataUrl && (
              <div className="mt-8">
                <button 
                  onClick={() => setIsComparing(true)}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-3"
                >
                  <FileUp size={24} />
                  Start Comparison
                </button>
              </div>
            )}
          </div>
        )}

        {/* Canvas Stage */}
        {isComparing && (
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            scaleX={zoom}
            scaleY={zoom}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            draggable={activeTool === null}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            ref={stageRef}
            className="bg-white"
          >
          <Layer>
            {/* White Background Rect for PDF area */}
            {(v1Img || v2Img) && (
              <Rect
                x={0}
                y={0}
                width={Math.max(v1Img?.width || 0, v2Img?.width || 0) + Math.abs(v2Offset.x)}
                height={Math.max(v1Img?.height || 0, v2Img?.height || 0) + Math.abs(v2Offset.y)}
                fill="white"
                shadowBlur={10}
                shadowColor="rgba(0,0,0,0.1)"
              />
            )}
            
            {/* V1 Image */}
            {v1Img && v1Visible && (
              <KonvaImage
                image={v1Img}
                x={0}
                y={0}
                opacity={0.7}
              />
            )}
            
            {/* V2 Image */}
            {v2Img && v2Visible && (
              <KonvaImage
                image={v2Img}
                x={v2Offset.x}
                y={v2Offset.y}
                draggable={activeTool === 'move' && !isMoveLocked}
                onDragMove={handleV2Drag}
                opacity={0.7}
              />
            )}

            {/* Annotations */}
            {annotationsVisible && (
              <Group>
                {annotations.map((ann) => (
                  <React.Fragment key={ann.id}>
                    {ann.type === 'box' && (
                      <Rect
                        x={ann.x}
                        y={ann.y}
                        width={ann.width}
                        height={ann.height}
                        stroke={ann.color}
                        strokeWidth={4}
                      />
                    )}
                    {ann.type === 'line' && (
                      <Line
                        points={ann.points}
                        stroke={ann.color}
                        strokeWidth={4}
                      />
                    )}
                    {ann.type === 'arrow' && (
                      <Arrow
                        points={ann.points}
                        stroke={ann.color}
                        fill={ann.color}
                        strokeWidth={4}
                      />
                    )}
                    {ann.type === 'text' && (
                      <KonvaText
                        x={ann.x}
                        y={ann.y}
                        text={ann.text}
                        fontSize={20}
                        fill={ann.color}
                      />
                    )}
                    {ann.type === 'cloud' && renderCloud(ann)}
                  </React.Fragment>
                ))}
                {/* Active Drawing */}
                {newAnnotation && (
                  <>
                    {newAnnotation.type === 'box' && (
                      <Rect
                        x={newAnnotation.x}
                        y={newAnnotation.y}
                        width={newAnnotation.width}
                        height={newAnnotation.height}
                        stroke={newAnnotation.color}
                        strokeWidth={4}
                      />
                    )}
                    {newAnnotation.type === 'line' && (
                      <Line
                        points={newAnnotation.points}
                        stroke={newAnnotation.color}
                        strokeWidth={4}
                      />
                    )}
                    {newAnnotation.type === 'arrow' && (
                      <Arrow
                        points={newAnnotation.points}
                        stroke={newAnnotation.color}
                        fill={newAnnotation.color}
                        strokeWidth={4}
                      />
                    )}
                    {newAnnotation.type === 'cloud' && renderCloud(newAnnotation)}
                  </>
                )}
              </Group>
            )}
          </Layer>
        </Stage>
      )}

        {/* Floating Toolbars */}
        {isComparing && (
          <div className="absolute top-6 left-6 flex flex-col gap-4">
            {/* Annotation Tools */}
            <div className="bg-white p-2 rounded-xl shadow-2xl border border-gray-200 flex flex-col gap-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Tools</p>
              <div className="flex flex-col gap-1">
                <ToolButton 
                  active={activeTool === 'move'} 
                  onClick={() => setActiveTool(activeTool === 'move' ? null : 'move')}
                  onDoubleClick={() => setActiveTool(null)}
                  icon={<Move size={20} />}
                  label="Move V2 (Double click to exit)"
                />
                <ToolButton 
                  active={isMoveLocked} 
                  onClick={() => setIsMoveLocked(!isMoveLocked)}
                  icon={isMoveLocked ? <Lock size={20} /> : <Unlock size={20} />}
                  label="Lock Position"
                />
              </div>
              <div className="h-px bg-gray-100 my-1" />
              <ToolButton 
                active={activeTool === 'box'} 
                onClick={() => setActiveTool('box')}
                onDoubleClick={() => setActiveTool(null)}
                icon={<Square size={20} />}
                label="Box"
              />
              <ToolButton 
                active={activeTool === 'line'} 
                onClick={() => setActiveTool('line')}
                onDoubleClick={() => setActiveTool(null)}
                icon={<Minus size={20} />}
                label="Line"
              />
              <ToolButton 
                active={activeTool === 'arrow'} 
                onClick={() => setActiveTool('arrow')}
                onDoubleClick={() => setActiveTool(null)}
                icon={<ArrowRight size={20} />}
                label="Arrow"
              />
              <ToolButton 
                active={activeTool === 'text'} 
                onClick={() => setActiveTool('text')}
                onDoubleClick={() => setActiveTool(null)}
                icon={<Type size={20} />}
                label="Text"
              />
              <ToolButton 
                active={activeTool === 'cloud'} 
                onClick={() => setActiveTool('cloud')}
                onDoubleClick={() => setActiveTool(null)}
                icon={<Cloud size={20} />}
                label="Cloud"
              />
              <div className="h-px bg-gray-100 my-1" />
              <ToolButton 
                active={annotationsVisible} 
                onClick={() => setAnnotationsVisible(!annotationsVisible)}
                icon={annotationsVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                label="Toggle Annotations"
              />
              <div className="h-px bg-gray-100 my-1" />
              <div className="px-2 py-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-gray-400" />
                  <input 
                    type="color" 
                    value={drawColor} 
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Movable Legend */}
        {isComparing && (
          <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-gray-200 w-56 select-none">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm">Legend</h4>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs font-medium">Base (V1)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setV1Visible(!v1Visible)}
                      className={cn("p-1 rounded hover:bg-gray-100", !v1Visible && "text-gray-300")}
                      title="Toggle Visibility"
                    >
                      {v1Visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button 
                      onClick={() => fileInputV1.current?.click()}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500"
                      title="Reupload V1"
                    >
                      <FileUp size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium">Target (V2)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setV2Visible(!v2Visible)}
                      className={cn("p-1 rounded hover:bg-gray-100", !v2Visible && "text-gray-300")}
                      title="Toggle Visibility"
                    >
                      {v2Visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button 
                      onClick={() => fileInputV2.current?.click()}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500"
                      title="Reupload V2"
                    >
                      <FileUp size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <button 
                onClick={handleFitToScreen}
                className="w-full py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase hover:bg-indigo-100 transition-colors"
              >
                Fit to Screen
              </button>
              <button 
                onClick={handleSaveJpg}
                className="w-full py-1 bg-green-50 text-green-600 rounded text-[10px] font-bold uppercase hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
              >
                <Download size={12} /> Save current status
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-white border-t border-gray-200 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          {isComparing && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                V1: {v1FileName || 'No file'}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                V2: {v2FileName || 'No file'}
              </div>
            </>
          )}
        </div>
        <p className="text-[10px] font-semibold text-gray-600">
          CompPDF App Developed by <span className="text-indigo-600">SriGaneshBabu</span>
        </p>
      </div>

      {/* Hidden Inputs */}
      <input type="file" ref={fileInputV1} onChange={handleUploadV1} accept=".pdf" className="hidden" />
      <input type="file" ref={fileInputV2} onChange={handleUploadV2} accept=".pdf" className="hidden" />
      <input type="file" ref={fileInputProject} onChange={handleOpenProject} accept=".comp" className="hidden" />
    </div>
  );
}

function ToolButton({ active, onClick, onDoubleClick, icon, label }: { active: boolean, onClick: () => void, onDoubleClick?: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={label}
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
        active 
          ? "bg-indigo-600 text-white shadow-lg scale-105" 
          : "text-gray-500 hover:bg-gray-100"
      )}
    >
      {icon}
    </button>
  );
}
