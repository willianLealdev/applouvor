import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Users, Plus, Trash2, Ban, CheckCircle, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { User, UserRole } from "@shared/schema";

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: string | null;
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "membro", label: "Membro", description: "Visualiza cultos e repertorios" },
  { value: "lider", label: "Lider", description: "Cria musicas, cultos e gerencia membros" },
  { value: "admin", label: "Admin", description: "Acesso completo ao sistema" },
];

function getRoleColor(role: UserRole): "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
      return "default";
    case "lider":
      return "secondary";
    case "membro":
      return "outline";
  }
}

function getRoleLabel(role: UserRole): string {
  return ROLES.find((r) => r.value === role)?.label || role;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Members() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const showNewModal = searchParams.includes("new=true");
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(showNewModal);
  const [formData, setFormData] = useState<{ name: string; email: string; role: UserRole }>({
    name: "",
    email: "",
    role: "membro",
  });

  const { data: members = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: UserRole }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddModal(false);
      setFormData({ name: "", email: "", role: "membro" });
      setLocation("/members");
      toast({ 
        title: "Membro cadastrado!", 
        description: "Uma senha provisoria foi enviada por email."
      });
    },
    onError: () => {
      toast({ title: "Erro ao convidar membro", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Membro removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover membro", variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/users/${id}/block`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: data.status === "blocked" ? "Membro bloqueado" : "Membro desbloqueado",
        description: data.status === "blocked" 
          ? "O membro não pode mais acessar o sistema."
          : "O membro pode acessar o sistema novamente."
      });
    },
    onError: () => {
      toast({ title: "Erro ao alterar status do membro", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/users/${id}/reset-password`);
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Email enviado!",
        description: "O membro recebera um email para redefinir a senha."
      });
    },
    onError: () => {
      toast({ title: "Erro ao enviar email de reset", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData({ name: "", email: "", role: "membro" });
    setLocation("/members");
  };

  const admins = members.filter((m) => m.role === "admin");
  const leaders = members.filter((m) => m.role === "lider");
  const membros = members.filter((m) => m.role === "membro");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Gestao de Membros</h1>
        <p className="text-muted-foreground">
          Cadastre e gerencie os membros da equipe de louvor
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={() => setShowAddModal(true)} data-testid="button-invite-member">
          <Plus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhum membro cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Convide os membros da equipe de louvor
            </p>
            <Button className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Convidar Membro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {admins.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">Admins ({admins.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {admins.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onDelete={() => deleteMutation.mutate(member.id)}
                    onBlock={() => blockMutation.mutate(member.id)}
                    onResetPassword={() => resetPasswordMutation.mutate(member.id)}
                    isAdmin={member.role === "admin"}
                  />
                ))}
              </div>
            </div>
          )}

          {leaders.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">Lideres ({leaders.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leaders.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onDelete={() => deleteMutation.mutate(member.id)}
                    onBlock={() => blockMutation.mutate(member.id)}
                    onResetPassword={() => resetPasswordMutation.mutate(member.id)}
                    isAdmin={false}
                  />
                ))}
              </div>
            </div>
          )}

          {membros.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">Membros ({membros.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {membros.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onDelete={() => deleteMutation.mutate(member.id)}
                    onBlock={() => blockMutation.mutate(member.id)}
                    onResetPassword={() => resetPasswordMutation.mutate(member.id)}
                    isAdmin={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo membro. Um email será enviado para ele criar sua senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
                data-testid="input-member-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                data-testid="input-member-email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger data-testid="select-member-role">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {role.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-member"
              >
                {createMutation.isPending ? "Enviando..." : "Enviar Convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({
  member,
  onDelete,
  onBlock,
  onResetPassword,
  isAdmin,
}: {
  member: SafeUser;
  onDelete: () => void;
  onBlock: () => void;
  onResetPassword: () => void;
  isAdmin: boolean;
}) {
  const isBlocked = member.status === "blocked";
  
  return (
    <Card className="hover-elevate" data-testid={`member-card-${member.id}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-medium">{member.name}</span>
          <span className="text-sm text-muted-foreground">{member.email}</span>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={getRoleColor(member.role)} className="text-xs">
              {getRoleLabel(member.role)}
            </Badge>
            {member.status === "pending" && (
              <Badge variant="outline" className="text-xs">
                Pendente
              </Badge>
            )}
            {member.status === "blocked" && (
              <Badge variant="destructive" className="text-xs">
                Bloqueado
              </Badge>
            )}
          </div>
        </div>
        {!isAdmin && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onResetPassword}
              title="Resetar senha"
              data-testid={`button-reset-password-${member.id}`}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onBlock}
              title={isBlocked ? "Desbloquear" : "Bloquear"}
              data-testid={`button-block-member-${member.id}`}
            >
              {isBlocked ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              title="Excluir membro"
              data-testid={`button-delete-member-${member.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
