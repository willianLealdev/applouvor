import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, X, Check, Trash2 } from "lucide-react";
import type { Song } from "@shared/schema";

const KEYS_MAJOR = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];
const KEYS_MINOR = [
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
];

const NOTE_MAP: { [key: string]: number } = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
  "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};
const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm", "Dbm", "Gbm", "Cbm"
]);

function getKeyBase(key: string): string {
  return key.replace("m", "");
}

function shouldUseFlats(key: string): boolean {
  if (key.includes("b")) return true;
  if (key.includes("#")) return false;
  return FLAT_KEYS.has(key);
}

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const noteRegex = /^([A-G])([#b]?)$/;
  const match = note.match(noteRegex);
  if (!match) return note;
  
  const [, root, modifier] = match;
  const noteValue = NOTE_MAP[root + modifier] ?? NOTE_MAP[root] ?? 0;
  const newValue = ((noteValue + semitones) % 12 + 12) % 12;
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return noteNames[newValue];
}

function transposeChord(chord: string, semitones: number, useFlats: boolean): string {
  const slashIndex = chord.indexOf("/");
  if (slashIndex !== -1) {
    const mainPart = chord.substring(0, slashIndex);
    const bassPart = chord.substring(slashIndex + 1);
    const mainTransposed = transposeChord(mainPart, semitones, useFlats);
    const bassTransposed = transposeNote(bassPart, semitones, useFlats);
    return mainTransposed + "/" + bassTransposed;
  }

  const chordRegex = /^([A-G])([#b]?)(.*)$/;
  const match = chord.match(chordRegex);
  if (!match) return chord;

  const [, root, modifier, suffix] = match;
  const noteValue = NOTE_MAP[root + modifier] ?? NOTE_MAP[root] ?? 0;
  const normalizedSemitones = ((semitones % 12) + 12) % 12;
  const newValue = ((noteValue + normalizedSemitones) % 12 + 12) % 12;
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return noteNames[newValue] + suffix;
}

function isChordToken(token: string): boolean {
  const chordRegex = /^[A-G][#b]?(?:m|M|maj|min|dim|aug|sus|add|7M|7m|7|9|11|13|6|5|4|2|\+|\-|°|ø|º|\([0-9#b+\-\/]+\))*(?:\/[A-G][#b]?)?$/;
  return chordRegex.test(token.trim());
}

function isChordOnlyLine(line: string): boolean {
  const cleanLine = line
    .replace(/\[(Intro|Verse|Chorus|Bridge|Refrão|Ponte|Solo|Tab|Instrumental|Pre-Chorus|Pré-Refrão|Outro|Final)\]/gi, "")
    .replace(/[|\-–—]/g, " ");
  if (cleanLine.includes("[") && cleanLine.includes("]")) return false;
  const tokens = cleanLine.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;
  const chordTokens = tokens.filter(t => isChordToken(t));
  return chordTokens.length > 0 && chordTokens.length >= tokens.length * 0.5;
}

function normalizeChordLine(line: string, semitones: number, useFlats: boolean): string {
  return line.replace(/([A-G][#b]?(?:m|M|maj|min|dim|aug|sus|add|7M|7m|7|9|11|13|6|5|4|2|\+|\-|°|ø|º|\([0-9#b+\-\/]+\))*(?:\/[A-G][#b]?)?)/g, (match, _, offset) => {
    const before = line.slice(Math.max(0, offset - 1), offset);
    if (before === "[") return match;
    if (isChordToken(match)) {
      const transposed = transposeChord(match, semitones, useFlats);
      return `[${transposed}]`;
    }
    return match;
  });
}

function transposeContent(content: string, fromKey: string, toKey: string): string {
  const fromBase = getKeyBase(fromKey);
  const toBase = getKeyBase(toKey);
  
  const fromValue = NOTE_MAP[fromBase];
  const toValue = NOTE_MAP[toBase];
  if (fromValue === undefined || toValue === undefined) return content;

  const semitones = toValue - fromValue;
  const useFlats = shouldUseFlats(toKey);

  const lines = content.split("\n");
  return lines.map(line => {
    if (isChordOnlyLine(line)) {
      return normalizeChordLine(line, semitones, useFlats);
    }
    return line.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) => {
      return `[${transposeChord(chord, semitones, useFlats)}]`;
    });
  }).join("\n");
}

interface ChordPosition {
  chord: string;
  position: number;
}

function parseLineWithChords(line: string): { lyrics: string; chords: ChordPosition[] } {
  const chords: ChordPosition[] = [];
  let lyrics = "";
  let currentPos = 0;

  const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);

  for (const part of parts) {
    const chordMatch = part.match(/^\[([A-G][#b]?[^\]]*)\]$/);
    if (chordMatch) {
      chords.push({ chord: chordMatch[1], position: currentPos });
    } else {
      lyrics += part;
      currentPos += part.length;
    }
  }

  return { lyrics, chords };
}

interface WordSegment {
  text: string;
  startPos: number;
  endPos: number;
  chordBefore?: string;
}

function parseLineIntoWords(line: string): WordSegment[] {
  const { lyrics, chords } = parseLineWithChords(line);
  const segments: WordSegment[] = [];
  
  const wordRegex = /(\S+|\s+)/g;
  let match;
  let pos = 0;
  
  while ((match = wordRegex.exec(lyrics)) !== null) {
    const text = match[1];
    const startPos = match.index;
    const endPos = startPos + text.length;
    
    const chordAtPos = chords.find(c => c.position >= startPos && c.position < endPos);
    const chordBefore = chords.find(c => c.position === startPos);
    
    segments.push({
      text,
      startPos,
      endPos,
      chordBefore: chordBefore?.chord || chordAtPos?.chord
    });
    pos = endPos;
  }
  
  if (segments.length === 0 && lyrics.length === 0 && chords.length > 0) {
    segments.push({
      text: "",
      startPos: 0,
      endPos: 0,
      chordBefore: chords[0]?.chord
    });
  }
  
  return segments;
}

interface ChordInputProps {
  onSubmit: (chord: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
  initialValue?: string;
}

function ChordInput({ onSubmit, onRemove, onCancel, initialValue = "" }: ChordInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && isChordToken(trimmed)) {
      onSubmit(trimmed);
    } else if (trimmed) {
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        placeholder="Ex: Am7, G#, Dm/F"
        className="h-8 text-sm w-32"
        data-testid="input-chord"
      />
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSubmit} data-testid="button-confirm-chord">
          <Check className="h-3 w-3" />
        </Button>
        {onRemove && initialValue && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={onRemove} data-testid="button-remove-chord">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel} data-testid="button-cancel-chord">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface EditableLineProps {
  line: string;
  lineIndex: number;
  showChords: boolean;
  isEditing: boolean;
  onLineChange: (lineIndex: number, newLine: string) => void;
}

function EditableLine({ line, lineIndex, showChords, isEditing, onLineChange }: EditableLineProps) {
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const segments = parseLineIntoWords(line);
  const { lyrics, chords } = parseLineWithChords(line);

  const handleChordSubmit = (segmentIndex: number, chord: string, existingChord?: string) => {
    const segment = segments[segmentIndex];
    if (!segment) return;

    let newLine = line;
    
    if (existingChord) {
      const chordPattern = new RegExp(`\\[${existingChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);
      newLine = newLine.replace(chordPattern, `[${chord}]`);
    } else {
      const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
      let reconstructed = "";
      let lyricPos = 0;
      
      for (const part of parts) {
        const chordMatch = part.match(/^\[([A-G][#b]?[^\]]*)\]$/);
        if (chordMatch) {
          reconstructed += part;
        } else {
          for (let i = 0; i < part.length; i++) {
            if (lyricPos === segment.startPos) {
              reconstructed += `[${chord}]`;
            }
            reconstructed += part[i];
            lyricPos++;
          }
        }
      }
      
      if (segment.startPos >= lyricPos) {
        reconstructed += `[${chord}]`;
      }
      
      newLine = reconstructed;
    }
    
    onLineChange(lineIndex, newLine);
    setActiveWordIndex(null);
  };

  const handleChordRemove = (segmentIndex: number, existingChord: string) => {
    const chordPattern = new RegExp(`\\[${existingChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);
    const newLine = line.replace(chordPattern, "");
    onLineChange(lineIndex, newLine);
    setActiveWordIndex(null);
  };

  if (!showChords || chords.length === 0) {
    if (!isEditing) {
      return (
        <div key={lineIndex} className="min-h-[1.5em]">
          {lyrics || "\u00A0"}
        </div>
      );
    }
    
    return (
      <div key={lineIndex} className="min-h-[1.5em]">
        <div className="flex flex-wrap">
          {segments.map((segment, idx) => {
            if (segment.text.match(/^\s+$/)) {
              return <span key={idx}>{segment.text}</span>;
            }
            
            return (
              <Popover 
                key={idx} 
                open={activeWordIndex === idx}
                onOpenChange={(open) => setActiveWordIndex(open ? idx : null)}
              >
                <PopoverTrigger asChild>
                  <span 
                    className="cursor-pointer hover:bg-primary/10 rounded px-0.5 transition-colors"
                    data-testid={`word-${lineIndex}-${idx}`}
                  >
                    {segment.text}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top">
                  <ChordInput
                    onSubmit={(chord) => handleChordSubmit(idx, chord)}
                    onCancel={() => setActiveWordIndex(null)}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
          {segments.length === 0 && "\u00A0"}
        </div>
      </div>
    );
  }

  let chordLine = "";
  let lastPos = 0;

  for (const { chord, position } of chords) {
    const spacesNeeded = Math.max(0, position - lastPos);
    chordLine += " ".repeat(spacesNeeded) + chord;
    lastPos = position + chord.length;
  }

  if (!isEditing) {
    return (
      <div key={lineIndex} className="mb-1">
        <div className="text-primary font-bold whitespace-pre min-h-[1.2em]">
          {chordLine || "\u00A0"}
        </div>
        <div className="min-h-[1.2em]">
          {lyrics || "\u00A0"}
        </div>
      </div>
    );
  }

  return (
    <div key={lineIndex} className="mb-1">
      <div className="text-primary font-bold whitespace-pre min-h-[1.2em] flex flex-wrap">
        {chords.map((chord, idx) => (
          <Popover 
            key={`chord-${idx}`}
            open={activeWordIndex === idx + 1000}
            onOpenChange={(open) => setActiveWordIndex(open ? idx + 1000 : null)}
          >
            <PopoverTrigger asChild>
              <span 
                className="cursor-pointer hover:bg-destructive/20 rounded px-0.5 transition-colors"
                style={{ marginLeft: idx === 0 ? `${chord.position}ch` : undefined }}
                data-testid={`chord-edit-${lineIndex}-${idx}`}
              >
                {chord.chord}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="top">
              <ChordInput
                initialValue={chord.chord}
                onSubmit={(newChord) => {
                  const segmentIdx = segments.findIndex(s => s.chordBefore === chord.chord);
                  handleChordSubmit(segmentIdx >= 0 ? segmentIdx : 0, newChord, chord.chord);
                }}
                onRemove={() => {
                  const segmentIdx = segments.findIndex(s => s.chordBefore === chord.chord);
                  handleChordRemove(segmentIdx >= 0 ? segmentIdx : 0, chord.chord);
                }}
                onCancel={() => setActiveWordIndex(null)}
              />
            </PopoverContent>
          </Popover>
        ))}
      </div>
      <div className="min-h-[1.2em] flex flex-wrap">
        {segments.map((segment, idx) => {
          if (segment.text.match(/^\s+$/)) {
            return <span key={idx}>{segment.text}</span>;
          }
          
          return (
            <Popover 
              key={idx}
              open={activeWordIndex === idx}
              onOpenChange={(open) => setActiveWordIndex(open ? idx : null)}
            >
              <PopoverTrigger asChild>
                <span 
                  className="cursor-pointer hover:bg-primary/10 rounded px-0.5 transition-colors"
                  data-testid={`word-${lineIndex}-${idx}`}
                >
                  {segment.text}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top">
                <ChordInput
                  initialValue={segment.chordBefore || ""}
                  onSubmit={(chord) => handleChordSubmit(idx, chord, segment.chordBefore)}
                  onRemove={segment.chordBefore ? () => handleChordRemove(idx, segment.chordBefore!) : undefined}
                  onCancel={() => setActiveWordIndex(null)}
                />
              </PopoverContent>
            </Popover>
          );
        })}
        {segments.length === 0 && "\u00A0"}
      </div>
    </div>
  );
}

interface SongViewerProps {
  song: Song;
  open: boolean;
  onClose: () => void;
  initialKey?: string;
  showChordsOnly?: boolean;
  onKeyChange?: (songId: string, newKey: string, transposedContent: string) => void;
  onContentChange?: (songId: string, newContent: string) => void;
  canEdit?: boolean;
}

export function SongViewer({
  song,
  open,
  onClose,
  initialKey,
  showChordsOnly = false,
  onKeyChange,
  onContentChange,
  canEdit = false,
}: SongViewerProps) {
  const [currentKey, setCurrentKey] = useState(initialKey || song.originalKey);
  const [showChords, setShowChords] = useState(!showChordsOnly);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(song.content);

  useEffect(() => {
    setCurrentKey(initialKey || song.originalKey);
  }, [song.id, initialKey, song.originalKey]);

  useEffect(() => {
    setEditedContent(song.content);
  }, [song.content]);

  const contentToDisplay = isEditing ? editedContent : song.content;
  const transposedContent = transposeContent(contentToDisplay, song.originalKey, currentKey);

  const handleKeyChange = (newKey: string) => {
    setCurrentKey(newKey);
    if (onKeyChange) {
      const newTransposedContent = transposeContent(contentToDisplay, song.originalKey, newKey);
      onKeyChange(song.id, newKey, newTransposedContent);
    }
  };

  const handleLineChange = (lineIndex: number, newLine: string) => {
    const lines = editedContent.split("\n");
    lines[lineIndex] = newLine;
    const newContent = lines.join("\n");
    setEditedContent(newContent);
  };

  const handleSaveEdits = () => {
    if (onContentChange && editedContent !== song.content) {
      onContentChange(song.id, editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdits = () => {
    setEditedContent(song.content);
    setIsEditing(false);
  };

  const renderContent = () => {
    const lines = transposedContent.split("\n");
    return lines.map((line, lineIndex) => (
      <EditableLine
        key={lineIndex}
        line={line}
        lineIndex={lineIndex}
        showChords={showChords}
        isEditing={isEditing}
        onLineChange={handleLineChange}
      />
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-xl">{song.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{song.artist}</p>
            </div>
            <div className="flex items-center gap-4">
              {canEdit && (
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="default" onClick={handleSaveEdits} data-testid="button-save-edits">
                        <Check className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdits} data-testid="button-cancel-edits">
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-chords">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar Acordes
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="show-chords" className="text-sm">
                  Mostrar Acordes
                </Label>
                <Switch
                  id="show-chords"
                  checked={showChords}
                  onCheckedChange={setShowChords}
                  data-testid="switch-show-chords"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tom:</span>
              <Select value={currentKey} onValueChange={handleKeyChange}>
                <SelectTrigger className="w-24" data-testid="select-song-key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Maiores</SelectLabel>
                    {KEYS_MAJOR.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Menores</SelectLabel>
                    {KEYS_MINOR.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {currentKey !== song.originalKey && (
                <Badge variant="outline" className="text-xs">
                  original: {song.originalKey}
                </Badge>
              )}
            </div>
            {isEditing && (
              <Badge variant="secondary" className="text-xs">
                Modo de Edição: Clique nas palavras para adicionar acordes
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div
            className="font-mono text-base leading-relaxed"
            data-testid="song-content"
          >
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
