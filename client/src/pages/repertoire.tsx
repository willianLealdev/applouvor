import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { joinService, leaveService, onServiceUpdate } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Edit, Save, X, ChevronUp, ChevronDown, Music, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { ServiceWithSongs, Song } from "@shared/schema";

const KEYS_MAJOR = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];
const KEYS_MINOR = [
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
];
const KEYS = [...KEYS_MAJOR, ...KEYS_MINOR];

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

function transposeChord(chord: string, semitones: number, useFlats: boolean = false): string {
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
  const getBaseKey = (key: string) => key.replace("m", "");
  const fromBase = getBaseKey(fromKey);
  const toBase = getBaseKey(toKey);
  
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

function renderChordLine(content: string, showChords: boolean): JSX.Element[] {
  const lines = content.split("\n");
  const result: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chordMatches = Array.from(line.matchAll(/\[([^\]]+)\]/g));

    if (chordMatches.length === 0) {
      result.push(
        <div key={i} className="min-h-[1.5em] whitespace-pre-wrap">
          {line || "\u00A0"}
        </div>
      );
    } else {
      let chordLine = "";
      let textLine = "";
      let lastIndex = 0;
      let chordPosition = 0;

      for (const match of chordMatches) {
        const beforeChord = line.substring(lastIndex, match.index);
        textLine += beforeChord;

        while (chordPosition < textLine.length) {
          chordLine += " ";
          chordPosition++;
        }

        chordLine += match[1];
        chordPosition += match[1].length;

        lastIndex = (match.index || 0) + match[0].length;
      }

      textLine += line.substring(lastIndex);

      if (showChords) {
        result.push(
          <div key={i} className="flex flex-col">
            <div className="text-primary font-bold whitespace-pre" style={{ fontFamily: "monospace" }}>
              {chordLine || "\u00A0"}
            </div>
            <div className="whitespace-pre-wrap" style={{ fontFamily: "monospace" }}>
              {textLine || "\u00A0"}
            </div>
          </div>
        );
      } else {
        result.push(
          <div key={i} className="whitespace-pre-wrap" style={{ fontFamily: "monospace" }}>
            {textLine || "\u00A0"}
          </div>
        );
      }
    }
  }

  return result;
}

export default function Repertoire() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const songRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [editingSong, setEditingSong] = useState<{ id: string; content: string; originalKey: string } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const [showChords, setShowChords] = useState(() => {
    const storageKey = `showChords_${user?.id || "default"}`;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : true;
  });

  useEffect(() => {
    const storageKey = `showChords_${user?.id || "default"}`;
    localStorage.setItem(storageKey, String(showChords));
  }, [showChords, user?.id]);

  const canEdit = user?.role === "admin" || user?.role === "lider";

  const { data: service, isLoading, refetch } = useQuery<ServiceWithSongs>({
    queryKey: ["/api/services", params.id],
    enabled: !!params.id,
  });

  useEffect(() => {
    if (params.id) {
      joinService(params.id);
      const unsubscribe = onServiceUpdate((data) => {
        queryClient.setQueryData(["/api/services", params.id], data);
      });
      return () => {
        leaveService(params.id!);
        unsubscribe();
      };
    }
  }, [params.id]);

  const updateKeyMutation = useMutation({
    mutationFn: async ({ serviceSongId, transposedKey }: { serviceSongId: string; transposedKey: string }) => {
      await apiRequest("PATCH", `/api/services/${params.id}/songs/${serviceSongId}`, { transposedKey });
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast({ title: "Erro ao alterar tom", variant: "destructive" });
    },
  });

  const updateSongMutation = useMutation({
    mutationFn: async ({ songId, content, originalKey }: { songId: string; content: string; originalKey: string }) => {
      await apiRequest("PATCH", `/api/songs/${songId}`, { content, originalKey });
    },
    onSuccess: () => {
      refetch();
      setShowEditDialog(false);
      setEditingSong(null);
      toast({ title: "Música atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar música", variant: "destructive" });
    },
  });

  const scrollToSong = (songId: string) => {
    const el = songRefs.current[songId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleEditSong = (song: Song) => {
    setEditingSong({
      id: song.id,
      content: song.content,
      originalKey: song.originalKey,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (editingSong) {
      updateSongMutation.mutate({
        songId: editingSong.id,
        content: editingSong.content,
        originalKey: editingSong.originalKey,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Culto não encontrado</p>
        <Button onClick={() => setLocation("/services")} data-testid="button-back-services">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const sortedSongs = [...(service.songs || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/services")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{service.name}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(service.date).toLocaleDateString("pt-BR")} - {service.time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="show-chords" className="text-sm cursor-pointer">
                {showChords ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Label>
              <Switch
                id="show-chords"
                checked={showChords}
                onCheckedChange={setShowChords}
                data-testid="toggle-show-chords"
              />
              <Label htmlFor="show-chords" className="text-sm cursor-pointer">
                Acordes
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">{sortedSongs.length} músicas</span>
          </div>
        </div>

        {sortedSongs.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            {sortedSongs.map((ss, index) => (
              <Button
                key={ss.id}
                variant="outline"
                size="sm"
                onClick={() => scrollToSong(ss.id)}
                className="whitespace-nowrap"
                data-testid={`nav-song-${index}`}
              >
                {index + 1}. {ss.song.title}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto p-4 space-y-8">
        {sortedSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Music className="h-16 w-16 mb-4 opacity-50" />
            <p>Nenhuma música no repertório</p>
          </div>
        ) : (
          sortedSongs.map((ss, index) => {
            const displayKey = ss.transposedKey || ss.song.originalKey;
            const transposedContent = transposeContent(ss.song.content, ss.song.originalKey, displayKey);

            return (
              <Card
                key={ss.id}
                ref={(el) => (songRefs.current[ss.id] = el)}
                className="scroll-mt-48"
                data-testid={`song-card-${index}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{index + 1}</span>
                      <div>
                        <CardTitle className="text-lg">{ss.song.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{ss.song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-sm">Tom:</Label>
                        <Select
                          value={displayKey}
                          onValueChange={(value) => updateKeyMutation.mutate({ serviceSongId: ss.id, transposedKey: value })}
                        >
                          <SelectTrigger className="w-20" data-testid={`select-key-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Maiores</div>
                            {KEYS_MAJOR.map((key) => (
                              <SelectItem key={key} value={key}>
                                {key}
                              </SelectItem>
                            ))}
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Menores</div>
                            {KEYS_MINOR.map((key) => (
                              <SelectItem key={key} value={key}>
                                {key}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSong(ss.song)}
                          data-testid={`button-edit-${index}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm leading-relaxed">
                    {renderChordLine(transposedContent, showChords)}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Música</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Label>Tom Original:</Label>
              <Select
                value={editingSong?.originalKey || "C"}
                onValueChange={(value) => setEditingSong((prev) => prev ? { ...prev, originalKey: value } : null)}
              >
                <SelectTrigger className="w-24" data-testid="select-edit-key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Maiores</div>
                  {KEYS_MAJOR.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Menores</div>
                  {KEYS_MINOR.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cifra (use [Acorde] para marcar acordes):</Label>
              <Textarea
                value={editingSong?.content || ""}
                onChange={(e) => setEditingSong((prev) => prev ? { ...prev, content: e.target.value } : null)}
                className="min-h-[400px] font-mono text-sm mt-2"
                data-testid="textarea-edit-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateSongMutation.isPending} data-testid="button-save-edit">
              {updateSongMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
