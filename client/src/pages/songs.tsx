import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Music, Plus, Search, Eye, Trash2, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SongViewer } from "@/components/song-viewer";
import type { Song, InsertSong } from "@shared/schema";

const KEYS_MAJOR: string[] = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];
const KEYS_MINOR: string[] = [
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
];
const KEYS: string[] = [...KEYS_MAJOR, ...KEYS_MINOR];

const NOTE_MAP: { [key: string]: number } = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
  "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function getKeyBase(key: string): string {
  return key.replace("m", "");
}

function isMinor(key: string): boolean {
  return key.endsWith("m");
}

function usesFlats(key: string): boolean {
  const base = getKeyBase(key);
  return base.includes("b");
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

function transposeChordForSave(chord: string, semitones: number, useFlats: boolean): string {
  const slashIndex = chord.indexOf("/");
  if (slashIndex !== -1) {
    const mainPart = chord.substring(0, slashIndex);
    const bassPart = chord.substring(slashIndex + 1);
    const mainTransposed = transposeChordForSave(mainPart, semitones, useFlats);
    const bassTransposed = transposeNote(bassPart, semitones, useFlats);
    return mainTransposed + "/" + bassTransposed;
  }

  const chordRegex = /^([A-G])([#b]?)(.*)$/;
  const match = chord.match(chordRegex);
  if (!match) return chord;
  
  const [, root, modifier, suffix] = match;
  const noteValue = NOTE_MAP[root + modifier] ?? NOTE_MAP[root] ?? 0;
  
  const newValue = ((noteValue + semitones) % 12 + 12) % 12;
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return noteNames[newValue] + suffix;
}

function transposeContentForSave(content: string, semitones: number, useFlats: boolean): string {
  if (semitones === 0) return content;
  return content.replace(/\[([A-G][#b]?[^\]]*)\]/g, (match, chord) => {
    return `[${transposeChordForSave(chord, semitones, useFlats)}]`;
  });
}

function calculateSemitones(fromKey: string, toKey: string): number {
  const fromBase = getKeyBase(fromKey);
  const toBase = getKeyBase(toKey);
  const fromValue = NOTE_MAP[fromBase];
  const toValue = NOTE_MAP[toBase];
  if (fromValue === undefined || toValue === undefined) return 0;
  return (toValue - fromValue + 12) % 12;
}

function parseCifraclubContent(rawContent: string): { content: string; detectedKey: string } {
  const lines = rawContent.split("\n");
  const result: string[] = [];
  let detectedKey = "";

  const chordSuffixPattern = "(?:m|M|maj|min|dim|aug|sus|add|7M|7m|7|9|11|13|6|5|4|2|\\+|\\-|°|ø|º|\\([0-9#b+\\-\\/]+\\))*(?:\\/[A-G][#b]?)?";
  const singleChordPattern = `[A-G][#b]?${chordSuffixPattern}`;
  const chordPattern = new RegExp(`^${singleChordPattern}(?:\\s+${singleChordPattern})*\\s*$`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    const cleanLine = line.replace(/\s+/g, " ").trim();

    if (chordPattern.test(cleanLine) && nextLine.trim() !== "" && !chordPattern.test(nextLine.trim())) {
      const chordMatchRegex = new RegExp(singleChordPattern, "g");
      const chords = cleanLine.match(chordMatchRegex) || [];

      if (chords.length > 0 && detectedKey === "" && chords[0]) {
        detectedKey = chords[0];
      }

      let combinedLine = "";
      let chordIndex = 0;
      const chordPositions: { pos: number; chord: string }[] = [];

      let pos = 0;
      for (const char of line) {
        if (char !== " " && chordIndex < chords.length) {
          const chord = chords[chordIndex];
          if (line.substring(pos).startsWith(chord)) {
            chordPositions.push({ pos, chord });
            chordIndex++;
            pos += chord.length;
            continue;
          }
        }
        pos++;
      }

      let lyricPos = 0;
      let chordPosIndex = 0;
      for (const char of nextLine) {
        while (chordPosIndex < chordPositions.length && chordPositions[chordPosIndex].pos <= lyricPos) {
          combinedLine += `[${chordPositions[chordPosIndex].chord}]`;
          chordPosIndex++;
        }
        combinedLine += char;
        lyricPos++;
      }

      while (chordPosIndex < chordPositions.length) {
        combinedLine += `[${chordPositions[chordPosIndex].chord}]`;
        chordPosIndex++;
      }

      result.push(combinedLine);
      i++;
    } else if (chordPattern.test(cleanLine)) {
      const chordMatchRegex = new RegExp(singleChordPattern, "g");
      const chords = cleanLine.match(chordMatchRegex) || [];
      if (chords.length > 0) {
        if (detectedKey === "" && chords[0]) {
          detectedKey = chords[0];
        }
        result.push(chords.map(c => `[${c}]`).join(" "));
      }
    } else if (line.trim() !== "") {
      result.push(line);
    } else {
      result.push("");
    }
  }

  if (detectedKey) {
    const keyMatch = detectedKey.match(/^([A-G][#b]?m?)/);
    if (keyMatch) {
      detectedKey = keyMatch[1];
    }
  }

  if (!detectedKey || !KEYS.includes(detectedKey)) {
    detectedKey = "C";
  }

  return { content: result.join("\n"), detectedKey };
}

export default function Songs() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const showNewModal = searchParams.includes("new=true");
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(showNewModal);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [cifraclubMode, setCifraclubMode] = useState<"direct" | "search">("direct");
  const [cifraclubArtist, setCifraclubArtist] = useState("");
  const [cifraclubSong, setCifraclubSong] = useState("");
  const [cifraclubSearch, setCifraclubSearch] = useState("");
  const [cifraclubResults, setCifraclubResults] = useState<{ title: string; artist: string; url: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    originalKey: "C",
    content: "",
    source: "manual",
  });
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");

  const { data: songs = [], isLoading } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSong) => {
      const res = await apiRequest("POST", "/api/songs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      setShowAddModal(false);
      resetForm();
      setLocation("/songs");
      toast({ title: "Musica adicionada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar musica", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/songs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({ title: "Musica removida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover musica", variant: "destructive" });
    },
  });

  const updateKeyMutation = useMutation({
    mutationFn: async ({ id, newKey, newContent }: { id: string; newKey: string; newContent: string }) => {
      await apiRequest("PATCH", `/api/songs/${id}`, { originalKey: newKey, content: newContent });
      return { id, newKey, newContent };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      if (selectedSong && selectedSong.id === data.id) {
        setSelectedSong({ ...selectedSong, originalKey: data.newKey, content: data.newContent });
      }
      toast({ title: "Tom atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tom", variant: "destructive" });
    },
  });

  const handleSongKeyChange = (songId: string, newKey: string, transposedContent: string) => {
    updateKeyMutation.mutate({ id: songId, newKey, newContent: transposedContent });
  };

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await apiRequest("PATCH", `/api/songs/${id}`, { content });
      return { id, content };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      if (selectedSong && selectedSong.id === data.id) {
        setSelectedSong({ ...selectedSong, content: data.content });
      }
      toast({ title: "Acordes atualizados!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar acordes", variant: "destructive" });
    },
  });

  const handleSongContentChange = (songId: string, newContent: string) => {
    updateContentMutation.mutate({ id: songId, content: newContent });
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ title: "", artist: "", originalKey: "C", content: "", source: "manual" });
    setCifraclubSearch("");
    setCifraclubResults([]);
    setActiveTab("manual");
    setDetectedKey(null);
    setOriginalContent("");
  };

  const handleCifraclubSearch = async () => {
    if (!cifraclubSearch.trim()) {
      toast({ title: "Digite o nome da música", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    setCifraclubResults([]);

    try {
      const res = await fetch(`/api/cifraclub/search?q=${encodeURIComponent(cifraclubSearch)}`);
      if (!res.ok) throw new Error("Erro na busca");
      const results = await res.json();
      setCifraclubResults(results);
      if (results.length === 0) {
        toast({ title: "Nenhuma música encontrada", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar no Cifraclub", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCifraclubResult = async (result: { title: string; artist: string; url: string }) => {
    setIsFetching(true);
    
    try {
      const res = await fetch(`/api/cifraclub/fetch?url=${encodeURIComponent(result.url)}`);
      if (!res.ok) throw new Error("Erro ao importar");
      
      const data = await res.json();
      const { content: parsedContent, detectedKey: detected } = parseCifraclubContent(data.content);
      
      setDetectedKey(detected);
      setOriginalContent(parsedContent);
      setFormData({
        title: data.title || result.title,
        artist: data.artist || result.artist,
        originalKey: detected,
        content: parsedContent,
        source: "cifraclub",
      });
      setCifraclubResults([]);
      setActiveTab("manual");
      toast({ title: "Música importada! Revise e salve." });
    } catch {
      toast({ title: "Erro ao importar música", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const handleKeyChange = (newKey: string) => {
    if (originalContent && detectedKey) {
      const semitones = calculateSemitones(detectedKey, newKey);
      const useFlats = usesFlats(newKey);
      const transposedContent = transposeContentForSave(originalContent, semitones, useFlats);
      setFormData({ ...formData, originalKey: newKey, content: transposedContent });
    } else if (formData.content.trim()) {
      setOriginalContent(formData.content);
      setDetectedKey(formData.originalKey);
      const semitones = calculateSemitones(formData.originalKey, newKey);
      const useFlats = usesFlats(newKey);
      const transposedContent = transposeContentForSave(formData.content, semitones, useFlats);
      setFormData({ ...formData, originalKey: newKey, content: transposedContent });
    } else {
      setFormData({ ...formData, originalKey: newKey });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.artist || !formData.content) {
      toast({ title: "Preencha todos os campos obrigatorios", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    resetForm();
    setLocation("/songs");
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleDirectImport = async () => {
    if (!cifraclubArtist.trim() || !cifraclubSong.trim()) {
      toast({ title: "Preencha o artista e o nome da música", variant: "destructive" });
      return;
    }

    setIsFetching(true);
    
    try {
      const artistSlug = slugify(cifraclubArtist);
      const songSlug = slugify(cifraclubSong);
      const url = `https://www.cifraclub.com.br/${artistSlug}/${songSlug}/`;
      
      const res = await fetch(`/api/cifraclub/fetch?url=${encodeURIComponent(url)}`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Música não encontrada");
      }
      
      const data = await res.json();
      const { content, detectedKey: detected } = parseCifraclubContent(data.content);
      const finalKey = KEYS.includes(detected) ? detected : "C";

      setDetectedKey(finalKey);
      setOriginalContent(content);
      setFormData({
        title: data.title || cifraclubSong,
        artist: data.artist || cifraclubArtist,
        content,
        originalKey: finalKey,
        source: "cifraclub",
      });

      toast({ title: "Cifra importada com sucesso! Altere o tom se necessário." });
      setActiveTab("manual");
      setCifraclubArtist("");
      setCifraclubSong("");
    } catch {
      toast({ 
        title: "Música não encontrada no Cifraclub", 
        description: "Verifique se o artista e nome da música estão corretos",
        variant: "destructive" 
      });
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Biblioteca de Musicas</h1>
        <p className="text-muted-foreground">
          Gerencie todas as musicas disponiveis para os cultos
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar musicas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-songs"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="button-add-song">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Musica
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredSongs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">
              {searchQuery ? "Nenhuma musica encontrada" : "Biblioteca vazia"}
            </p>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Tente buscar por outro termo"
                : "Adicione sua primeira musica para comecar"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Musica
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSongs.map((song) => (
            <Card key={song.id} className="hover-elevate" data-testid={`song-card-${song.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">{song.title}</CardTitle>
                    <CardDescription>{song.artist}</CardDescription>
                  </div>
                  <Badge variant="secondary">{song.originalKey}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSong(song);
                      setShowViewer(true);
                    }}
                    data-testid={`button-view-song-${song.id}`}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(song.id)}
                    data-testid={`button-delete-song-${song.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {song.source && song.source !== "manual" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fonte: {song.source}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Musica</DialogTitle>
            <DialogDescription>
              Adicione manualmente ou importe do Cifraclub
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" data-testid="tab-manual">
                <Plus className="mr-2 h-4 w-4" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="cifraclub" data-testid="tab-cifraclub">
                <Download className="mr-2 h-4 w-4" />
                Cifraclub
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cifraclub" className="flex flex-col gap-4 mt-4">
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={cifraclubMode === "direct" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCifraclubMode("direct")}
                  data-testid="button-mode-direct"
                >
                  Por Artista + Música
                </Button>
                <Button
                  type="button"
                  variant={cifraclubMode === "search" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCifraclubMode("search")}
                  data-testid="button-mode-search"
                >
                  Buscar por Nome
                </Button>
              </div>

              {cifraclubMode === "direct" && (
                <div className="flex flex-col gap-4 p-4 rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Digite o nome do artista e da música exatamente como aparece no Cifraclub
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cifra-artist" className="text-sm">Artista</Label>
                      <Input
                        id="cifra-artist"
                        placeholder="Ex: Fernandinho, Aline Barros, Gabriela Rocha..."
                        value={cifraclubArtist}
                        onChange={(e) => setCifraclubArtist(e.target.value)}
                        disabled={isFetching}
                        data-testid="input-cifraclub-artist"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cifra-song" className="text-sm">Nome da Música</Label>
                      <Input
                        id="cifra-song"
                        placeholder="Ex: Faz Chover, Ressuscita-me, Lugar Secreto..."
                        value={cifraclubSong}
                        onChange={(e) => setCifraclubSong(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleDirectImport()}
                        disabled={isFetching}
                        data-testid="input-cifraclub-song"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleDirectImport}
                    disabled={isFetching || !cifraclubArtist.trim() || !cifraclubSong.trim()}
                    className="w-full"
                    data-testid="button-import-direct"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Importar do Cifraclub
                      </>
                    )}
                  </Button>
                </div>
              )}

              {cifraclubMode === "search" && (
                <>
                  <div className="flex flex-col gap-2 p-4 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">
                      Digite o nome da música para buscar no Cifraclub
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex: Faz Chover, Ressuscita-me, Lugar Secreto..."
                        value={cifraclubSearch}
                        onChange={(e) => setCifraclubSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCifraclubSearch()}
                        disabled={isSearching || isFetching}
                        data-testid="input-cifraclub-search"
                      />
                      <Button
                        type="button"
                        onClick={handleCifraclubSearch}
                        disabled={isSearching || isFetching || !cifraclubSearch.trim()}
                        data-testid="button-search-cifraclub"
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {isFetching && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Importando música...</span>
                    </div>
                  )}

                  {cifraclubResults.length > 0 && !isFetching && (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Selecione uma música:</p>
                      <ScrollArea className="h-[300px] rounded-md border">
                        <div className="p-2 space-y-2">
                          {cifraclubResults.map((result, index) => (
                            <div
                              key={index}
                              onClick={() => handleSelectCifraclubResult(result)}
                              className="flex flex-col p-3 rounded-md border cursor-pointer hover-elevate"
                              data-testid={`cifraclub-result-${index}`}
                            >
                              <span className="font-medium">{result.title}</span>
                              <span className="text-sm text-muted-foreground">{result.artist}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="title">Titulo *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Nome da musica"
                      data-testid="input-song-title"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="artist">Artista *</Label>
                    <Input
                      id="artist"
                      value={formData.artist}
                      onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                      placeholder="Nome do artista"
                      data-testid="input-song-artist"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="key">
                    Tom Original
                    {detectedKey && detectedKey !== formData.originalKey && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (detectado: {detectedKey}, transpondo para {formData.originalKey})
                      </span>
                    )}
                  </Label>
                  <Select
                    value={formData.originalKey}
                    onValueChange={handleKeyChange}
                  >
                    <SelectTrigger data-testid="select-song-key">
                      <SelectValue placeholder="Selecione o tom" />
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content">Letra e Cifra *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={`Exemplo:\n\n[C]Santo, Santo, [G]Santo\n[Am]Senhor Deus do [F]universo\n[C]Os ceus e a [G]terra\n[Am]Proclamam a [F]Tua gloria`}
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-song-content"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-song"
                  >
                    {createMutation.isPending ? "Salvando..." : "Salvar Musica"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedSong && (
        <SongViewer
          song={selectedSong}
          open={showViewer}
          onClose={() => {
            setShowViewer(false);
            setSelectedSong(null);
          }}
          onKeyChange={handleSongKeyChange}
          onContentChange={handleSongContentChange}
          canEdit={true}
        />
      )}
    </div>
  );
}
