import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Music, Users, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Service, Song, User } from "@shared/schema";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: number;
  icon: typeof Calendar;
  description: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: songs = [], isLoading: loadingSongs } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingServices = services
    .filter((s) => {
      const serviceDate = new Date(s.date + "T00:00:00");
      serviceDate.setHours(0, 0, 0, 0);
      return serviceDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const activeMembers = members.filter((m) => m.status === "active" && m.role !== "admin");

  const recentSongs = songs.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao sistema de gestao de musicas para o louvor
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Proximos Cultos"
          value={upcomingServices.length}
          icon={Calendar}
          description="Cultos agendados"
          loading={loadingServices}
        />
        <StatCard
          title="Musicas"
          value={songs.length}
          icon={Music}
          description="Na biblioteca"
          loading={loadingSongs}
        />
        <StatCard
          title="Membros"
          value={activeMembers.length}
          icon={Users}
          description="Na equipe"
          loading={loadingMembers}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild data-testid="button-new-service">
          <Link href="/services?new=true">
            <Plus className="mr-2 h-4 w-4" />
            Novo Culto
          </Link>
        </Button>
        <Button variant="outline" asChild data-testid="button-add-song">
          <Link href="/songs?new=true">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Musica
          </Link>
        </Button>
        <Button variant="outline" asChild data-testid="button-invite-member">
          <Link href="/members?new=true">
            <Plus className="mr-2 h-4 w-4" />
            Convidar Membro
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Proximos Cultos</CardTitle>
              <CardDescription>Cultos agendados para os proximos dias</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/services">
                Ver todos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingServices ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : upcomingServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum culto agendado
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/services?new=true">Agendar Culto</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingServices.map((service) => (
                  <Link
                    key={service.id}
                    href={`/services/${service.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                    data-testid={`service-card-${service.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{service.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(service.date).toLocaleDateString("pt-BR")} - {service.time}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Musicas Recentes</CardTitle>
              <CardDescription>Ultimas musicas adicionadas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/songs">
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingSongs ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma musica na biblioteca
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/songs?new=true">Adicionar Musica</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSongs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between rounded-md border p-3"
                    data-testid={`song-item-${song.id}`}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
