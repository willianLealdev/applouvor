import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch, useParams, Route } from "wouter";
import {
  Calendar,
  Plus,
  Clock,
  Music,
  ArrowRight,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Eye,
  Pencil,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SongViewer } from "@/components/song-viewer";
import type { Service, Song, ServiceWithSongs, ServiceSongWithDetails, InsertService } from "@shared/schema";

const KEYS_MAJOR = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];
const KEYS_MINOR = [
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
];
const KEYS = [...KEYS_MAJOR, ...KEYS_MINOR];

function ServicesList() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const showNewModal = searchParams.includes("new=true");
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(showNewModal);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<InsertService>({
    name: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
  });

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      const res = await apiRequest("POST", "/api/services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setShowAddModal(false);
      setFormData({ name: "", date: new Date().toISOString().split("T")[0], time: "10:00" });
      setLocation("/services");
      toast({ title: "Culto criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar culto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Culto removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover culto", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertService }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setShowEditModal(false);
      setEditingService(null);
      setFormData({ name: "", date: new Date().toISOString().split("T")[0], time: "10:00" });
      toast({ title: "Culto atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar culto", variant: "destructive" });
    },
  });

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      date: service.date,
      time: service.time,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !formData.name) {
      toast({ title: "Preencha o nome do culto", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingService.id, data: formData });
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingService(null);
    setFormData({ name: "", date: new Date().toISOString().split("T")[0], time: "10:00" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "Preencha o nome do culto", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData({ name: "", date: new Date().toISOString().split("T")[0], time: "10:00" });
    setLocation("/services");
  };

  const sortedServices = [...services].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const upcomingServices = sortedServices.filter((s) => new Date(s.date) >= new Date());
  const pastServices = sortedServices.filter((s) => new Date(s.date) < new Date());

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Gestao de Cultos</h1>
        <p className="text-muted-foreground">
          Crie e organize os cultos e suas musicas
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={() => setShowAddModal(true)} data-testid="button-new-service">
          <Plus className="mr-2 h-4 w-4" />
          Novo Culto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhum culto agendado</p>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro culto para comecar
            </p>
            <Button className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Culto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {upcomingServices.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">Proximos Cultos</h2>
              <div className="flex flex-col gap-3">
                {upcomingServices.map((service) => (
                  <Card key={service.id} className="hover-elevate" data-testid={`service-card-${service.id}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <Link
                        href={`/services/${service.id}`}
                        className="flex flex-1 items-center gap-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{service.name}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {new Date(service.date).toLocaleDateString("pt-BR", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                            </span>
                            <Clock className="h-3 w-3" />
                            <span>{service.time}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/services/${service.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(service);
                          }}
                          title="Editar culto"
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(service.id);
                          }}
                          title="Excluir culto"
                          data-testid={`button-delete-service-${service.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastServices.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium text-muted-foreground">Cultos Anteriores</h2>
              <div className="flex flex-col gap-3">
                {pastServices.map((service) => (
                  <Card
                    key={service.id}
                    className="opacity-60 hover-elevate"
                    data-testid={`service-card-${service.id}`}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <Link
                        href={`/services/${service.id}`}
                        className="flex flex-1 items-center gap-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{service.name}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {new Date(service.date).toLocaleDateString("pt-BR")}
                            </span>
                            <Clock className="h-3 w-3" />
                            <span>{service.time}</span>
                          </div>
                        </div>
                      </Link>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/services/${service.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Culto</DialogTitle>
            <DialogDescription>
              Preencha os dados do culto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome do Culto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Culto de Domingo, Culto de Ceia..."
                data-testid="input-service-name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-service-date"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="time">Horario</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-service-time"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-service"
              >
                {createMutation.isPending ? "Criando..." : "Criar Culto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={handleCloseEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Culto</DialogTitle>
            <DialogDescription>
              Altere os dados do culto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Nome do Culto *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Culto de Domingo, Culto de Ceia..."
                data-testid="input-edit-service-name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-date">Data</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-edit-service-date"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-time">Horario</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-edit-service-time"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEditModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-update-service"
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar Alteracoes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", date: "", time: "" });
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerKey, setViewerKey] = useState<string | undefined>();

  const { data: service, isLoading } = useQuery<ServiceWithSongs>({
    queryKey: ["/api/services", params.id],
  });

  const { data: allSongs = [] } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
  });

  const addSongMutation = useMutation({
    mutationFn: async ({ songId, transposedKey }: { songId: string; transposedKey?: string }) => {
      const res = await apiRequest("POST", `/api/services/${params.id}/songs`, {
        songId,
        transposedKey,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", params.id] });
      setShowAddSongModal(false);
      toast({ title: "Musica adicionada ao culto!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar musica", variant: "destructive" });
    },
  });

  const removeSongMutation = useMutation({
    mutationFn: async (serviceSongId: string) => {
      await apiRequest("DELETE", `/api/services/${params.id}/songs/${serviceSongId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", params.id] });
      toast({ title: "Musica removida do culto!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover musica", variant: "destructive" });
    },
  });

  const updateKeyMutation = useMutation({
    mutationFn: async ({ serviceSongId, transposedKey }: { serviceSongId: string; transposedKey: string }) => {
      const res = await apiRequest("PATCH", `/api/services/${params.id}/songs/${serviceSongId}`, {
        transposedKey,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", params.id] });
      toast({ title: "Tom atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tom", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (songOrders: { id: string; order: number }[]) => {
      const res = await apiRequest("PUT", `/api/services/${params.id}/songs/reorder`, {
        songOrders,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", params.id] });
    },
    onError: () => {
      toast({ title: "Erro ao reordenar musicas", variant: "destructive" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: { name: string; date: string; time: string }) => {
      const res = await apiRequest("PATCH", `/api/services/${params.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setShowEditServiceModal(false);
      toast({ title: "Culto atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar culto", variant: "destructive" });
    },
  });

  const handleOpenEditService = () => {
    if (service) {
      setEditFormData({
        name: service.name,
        date: service.date,
        time: service.time,
      });
      setShowEditServiceModal(true);
    }
  };

  const handleEditServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name) {
      toast({ title: "Preencha o nome do culto", variant: "destructive" });
      return;
    }
    updateServiceMutation.mutate(editFormData);
  };

  const handleMoveUp = (index: number) => {
    if (!service || index === 0) return;
    const sortedSongs = [...service.songs].sort((a, b) => a.order - b.order);
    const newOrders = sortedSongs.map((song, i) => {
      if (i === index) return { id: song.id, order: sortedSongs[i - 1].order };
      if (i === index - 1) return { id: song.id, order: sortedSongs[i + 1].order };
      return { id: song.id, order: song.order };
    });
    reorderMutation.mutate(newOrders);
  };

  const handleMoveDown = (index: number) => {
    if (!service || index === service.songs.length - 1) return;
    const sortedSongs = [...service.songs].sort((a, b) => a.order - b.order);
    const newOrders = sortedSongs.map((song, i) => {
      if (i === index) return { id: song.id, order: sortedSongs[i + 1].order };
      if (i === index + 1) return { id: song.id, order: sortedSongs[i - 1].order };
      return { id: song.id, order: song.order };
    });
    reorderMutation.mutate(newOrders);
  };

  const availableSongs = allSongs.filter(
    (song) => !service?.songs.some((ss) => ss.songId === song.id)
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <Calendar className="h-16 w-16 text-muted-foreground/50" />
        <p className="text-lg font-medium">Culto nao encontrado</p>
        <Button asChild>
          <Link href="/services">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/services">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{service.name}</h1>
            <p className="text-muted-foreground">
              {new Date(service.date).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              as {service.time}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleOpenEditService}
          data-testid="button-edit-service-detail"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar Culto
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Repertorio</CardTitle>
            <CardDescription>
              {service.songs.length} {service.songs.length === 1 ? "musica" : "musicas"} no culto
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {service.songs.length > 0 && (
              <Button variant="outline" asChild data-testid="button-view-repertoire">
                <Link href={`/repertoire/${service.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar Repertorio
                </Link>
              </Button>
            )}
            <Button onClick={() => setShowAddSongModal(true)} data-testid="button-add-song-to-service">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Musica
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {service.songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Music className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma musica adicionada
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowAddSongModal(true)}
              >
                Adicionar Musica
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {service.songs
                .sort((a, b) => a.order - b.order)
                .map((serviceSong, index) => (
                  <div
                    key={serviceSong.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                    data-testid={`service-song-${serviceSong.id}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        data-testid={`button-move-up-${serviceSong.id}`}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === service.songs.length - 1}
                        data-testid={`button-move-down-${serviceSong.id}`}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="font-medium">{serviceSong.song.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {serviceSong.song.artist}
                      </span>
                    </div>
                    <Select
                      value={serviceSong.transposedKey || serviceSong.song.originalKey}
                      onValueChange={(value) =>
                        updateKeyMutation.mutate({
                          serviceSongId: serviceSong.id,
                          transposedKey: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-20" data-testid={`select-key-${serviceSong.id}`}>
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setSelectedSong(serviceSong.song);
                        setViewerKey(serviceSong.transposedKey || serviceSong.song.originalKey);
                        setShowViewer(true);
                      }}
                      data-testid={`button-view-${serviceSong.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSongMutation.mutate(serviceSong.id)}
                      data-testid={`button-remove-${serviceSong.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddSongModal} onOpenChange={setShowAddSongModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Musica ao Culto</DialogTitle>
            <DialogDescription>
              Selecione uma musica da biblioteca
            </DialogDescription>
          </DialogHeader>
          {availableSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Music className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {allSongs.length === 0
                  ? "Nenhuma musica na biblioteca"
                  : "Todas as musicas ja foram adicionadas"}
              </p>
              {allSongs.length === 0 && (
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/songs?new=true">Adicionar Musica</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
              {availableSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between rounded-md border p-3 hover-elevate cursor-pointer"
                  onClick={() => addSongMutation.mutate({ songId: song.id })}
                  data-testid={`add-song-${song.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{song.title}</span>
                    <span className="text-sm text-muted-foreground">{song.artist}</span>
                  </div>
                  <Badge variant="secondary">{song.originalKey}</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditServiceModal} onOpenChange={setShowEditServiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Culto</DialogTitle>
            <DialogDescription>
              Altere as informacoes do culto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditServiceSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-service-name">Nome do Culto *</Label>
              <Input
                id="edit-service-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Ex: Culto de Domingo, Culto de Ceia..."
                data-testid="input-edit-service-name-detail"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-service-date">Data</Label>
                <Input
                  id="edit-service-date"
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  data-testid="input-edit-service-date-detail"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-service-time">Horario</Label>
                <Input
                  id="edit-service-time"
                  type="time"
                  value={editFormData.time}
                  onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                  data-testid="input-edit-service-time-detail"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditServiceModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateServiceMutation.isPending}
                data-testid="button-save-edit-service-detail"
              >
                {updateServiceMutation.isPending ? "Salvando..." : "Salvar Alteracoes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedSong && (
        <SongViewer
          song={selectedSong}
          open={showViewer}
          onClose={() => {
            setShowViewer(false);
            setSelectedSong(null);
            setViewerKey(undefined);
          }}
          initialKey={viewerKey}
        />
      )}
    </div>
  );
}

export default function Services() {
  return (
    <>
      <Route path="/services" component={ServicesList} />
      <Route path="/services/:id" component={ServiceDetail} />
    </>
  );
}
