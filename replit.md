# Louvor App - Sistema de Gestão de Músicas para Louvor

## Visão Geral
Aplicação web para gerenciar músicas de louvor em cultos. Sistema multi-usuário com três níveis de acesso (Admin, Líder, Membro) com autenticação e controle de permissões.

## Estrutura do Projeto

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   │   ├── ui/        # Componentes Shadcn
│   │   │   ├── app-sidebar.tsx    # Navegação lateral (com permissões)
│   │   │   ├── song-viewer.tsx    # Visualizador de cifras
│   │   │   └── theme-toggle.tsx   # Alternador de tema
│   │   ├── lib/
│   │   │   ├── auth.tsx           # Contexto de autenticação
│   │   │   ├── queryClient.ts     # TanStack Query config
│   │   │   └── socket.ts          # Socket.IO client
│   │   ├── pages/         # Páginas da aplicação
│   │   │   ├── login.tsx          # Página de login
│   │   │   ├── dashboard.tsx      # Página inicial
│   │   │   ├── songs.tsx          # Biblioteca de músicas
│   │   │   ├── services.tsx       # Gestão de cultos
│   │   │   ├── repertoire.tsx     # Visualizador de repertório
│   │   │   └── members.tsx        # Gestão de membros
│   │   └── App.tsx        # Componente raiz
├── server/                 # Backend Express
│   ├── auth.ts            # Passport.js configuração
│   ├── db.ts              # Conexão PostgreSQL
│   ├── index.ts           # Entrada com sessões e passport
│   ├── routes.ts          # Rotas da API (protegidas)
│   ├── socket.ts          # Socket.IO server
│   └── storage.ts         # Camada de persistência
└── shared/
    └── schema.ts          # Modelos de dados Drizzle
```

## Autenticação e Autorização

### Níveis de Acesso
- **Admin**: Acesso total a todas as funcionalidades
- **Líder**: Cria músicas, importa do Cifraclub, cria cultos, gerencia membros
- **Membro**: Visualiza apenas cultos e repertórios

### Usuário Admin Inicial
- Email: willianlealusa@gmail.com
- Senha: D7i9G6i8

### Fluxo de Convite
1. Líder/Admin cadastra membro com nome e email
2. Sistema gera token de convite (válido 7 dias)
3. Membro acessa link de convite para criar senha
4. Status muda de "pending" para "active"

### Bloqueio de Usuários
- Líder/Admin pode bloquear/desbloquear membros
- Usuários bloqueados não conseguem fazer login

## Funcionalidades

### Gestão de Músicas (Admin/Líder)
- Adicionar músicas manualmente ou importar do Cifraclub
- Formato de cifra: `[Acorde]Letra` ex: `[G]Santo Santo`
- Visualização com acordes ACIMA das palavras (formato Cifraclub)
- Transposição automática de tom (maiores e menores)

### Importação Automática do Cifraclub
- Busca músicas diretamente no Cifraclub por nome
- Seleciona a música desejada nos resultados
- Importa cifra automaticamente (sem copiar/colar)
- Parser converte para formato interno [Acorde]
- Detecta o tom original da música

### Gestão de Cultos
- Criar cultos com nome, data e horário (Admin/Líder)
- Adicionar músicas ao repertório (Admin/Líder)
- Reordenar músicas (mover para cima/baixo)
- Ajustar tom individual por música no culto
- Atualizações em tempo real via WebSocket

### Visualizador de Repertório
- Visualização sequencial de todas as músicas do culto
- Navegação rápida entre músicas (barra superior)
- Toggle para mostrar/ocultar acordes (por usuário, salvo em localStorage)
- Edição inline de músicas (Admin/Líder)
- Mudança de tom individual

### Gestão de Membros (Admin/Líder)
- Cadastrar membros com nome, email e papel
- Papéis: Admin, Líder, Membro
- Status: Pendente, Ativo, Bloqueado
- Bloquear/Desbloquear membros

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login com email/senha
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuário atual
- `POST /api/auth/register` - Ativar conta via token

### Usuários (Autenticado, Admin/Líder)
- `GET /api/users` - Lista todos os usuários
- `POST /api/users` - Cria novo usuário (gera convite)
- `PATCH /api/users/:id/block` - Bloquear/Desbloquear
- `DELETE /api/users/:id` - Remove usuário

### Músicas (Autenticado)
- `GET /api/songs` - Lista todas as músicas (Admin/Líder)
- `GET /api/songs/:id` - Busca música por ID
- `POST /api/songs` - Cria nova música (Admin/Líder)
- `PATCH /api/songs/:id` - Atualiza música (Admin/Líder)
- `DELETE /api/songs/:id` - Remove música (Admin/Líder)

### Cultos (Autenticado)
- `GET /api/services` - Lista todos os cultos
- `GET /api/services/:id` - Busca culto com músicas
- `POST /api/services` - Cria novo culto (Admin/Líder)
- `DELETE /api/services/:id` - Remove culto (Admin/Líder)

### Músicas do Culto (Autenticado)
- `POST /api/services/:id/songs` - Adiciona música (Admin/Líder)
- `PATCH /api/services/:serviceId/songs/:serviceSongId` - Atualiza tom/ordem (Admin/Líder)
- `PUT /api/services/:serviceId/songs/reorder` - Reordena músicas (Admin/Líder)
- `DELETE /api/services/:serviceId/songs/:serviceSongId` - Remove música (Admin/Líder)

### Cifraclub (Admin/Líder)
- `GET /api/cifraclub/search?q=query` - Busca no Cifraclub
- `GET /api/cifraclub/fetch?url=url` - Importa cifra

## Tecnologias

- **Frontend**: React, TanStack Query, Wouter, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, TypeScript, Passport.js
- **Autenticação**: express-session, connect-pg-simple, bcrypt
- **Real-time**: Socket.IO
- **Banco de Dados**: PostgreSQL com Drizzle ORM
- **Validação**: Zod

## Comandos

```bash
npm run dev      # Inicia servidor de desenvolvimento
npm run db:push  # Sincroniza schema com banco de dados
```

## Configuração

O projeto utiliza variáveis de ambiente:
- `DATABASE_URL` - URL de conexão PostgreSQL (configurado automaticamente)
- `SESSION_SECRET` - Chave secreta para sessões
