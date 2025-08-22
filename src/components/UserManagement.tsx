import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Calendar, Shield, UserCheck, Trash2, Building2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'client' | 'facility_owner' | 'admin';
  created_at: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userStats, setUserStats] = useState({
    clients: 0,
    facilityOwners: 0,
    admins: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setUsers(data || []);
      setFilteredUsers(data || []);
      
      // Calculate stats
      const stats = {
        clients: data?.filter(user => user.role === 'client').length || 0,
        facilityOwners: data?.filter(user => user.role === 'facility_owner').length || 0,
        admins: data?.filter(user => user.role === 'admin').length || 0
      };
      setUserStats(stats);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca utilizatorii",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const promoteToAdmin = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('promote_user_to_admin_secure', {
        _user_id: userId
      });

      if (error) {
        throw error;
      }

      if (data) {
        toast({
          title: "Succes",
          description: `Utilizatorul ${userEmail} a fost promovat ca administrator.`,
        });
        fetchUsers(); // Refresh the list
      } else {
        toast({
          title: "Eroare",
          description: "Utilizatorul nu a fost găsit.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error promoting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut promova utilizatorul. Doar administratorii pot promova utilizatori.",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_user_account_secure', {
        _user_id: userId
      });

      if (error) {
        throw error;
      }

      if (data) {
        toast({
          title: "Succes",
          description: `Contul utilizatorului ${userEmail} a fost șters.`,
        });
        fetchUsers(); // Refresh the list
      } else {
        toast({
          title: "Eroare",
          description: "Utilizatorul nu a fost găsit.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge utilizatorul. Doar administratorii pot șterge utilizatori.",
        variant: "destructive",
      });
    }
  };

  const promoteToFacilityOwner = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('promote_user_to_facility_owner_secure', {
        _user_id: userId
      });

      if (error) {
        throw error;
      }

      if (data) {
        toast({
          title: "Succes",
          description: `Utilizatorul ${userEmail} a fost promovat ca proprietar de bază sportivă.`,
        });
        fetchUsers(); // Refresh the list
      } else {
        toast({
          title: "Eroare",
          description: "Utilizatorul nu a fost găsit.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error promoting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut promova utilizatorul. Doar administratorii pot promova utilizatori.",
        variant: "destructive",
      });
    }
  };

  const filterUsers = (role: string) => {
    setRoleFilter(role);
    if (role === 'all') {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(user => user.role === role));
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive" className="bg-red-600 hover:bg-red-700"><Shield className="w-3 h-3 mr-1" />Administrator</Badge>;
      case 'facility_owner':
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700"><Building2 className="w-3 h-3 mr-1" />Bază Sportivă</Badge>;
      case 'client':
        return <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white"><Users className="w-3 h-3 mr-1" />Client</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Acces complet la panoul de administrare';
      case 'facility_owner':
        return 'Poate gestiona baze sportive și facilități';
      case 'client':
        return 'Poate face rezervări la facilități sportive';
      default:
        return 'Rol necunoscut';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Se încarcă utilizatorii...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clienți</p>
                <p className="text-2xl font-bold text-green-600">{userStats.clients}</p>
                <p className="text-xs text-muted-foreground">Utilizatori care fac rezervări</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Baze Sportive</p>
                <p className="text-2xl font-bold text-blue-600">{userStats.facilityOwners}</p>
                <p className="text-xs text-muted-foreground">Proprietari de facilități</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Administratori</p>
                <p className="text-2xl font-bold text-red-600">{userStats.admins}</p>
                <p className="text-xs text-muted-foreground">Administratori platformei</p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestionare Utilizatori</h2>
          <p className="text-muted-foreground">Vizualizați și gestionați toți utilizatorii platformei</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={roleFilter} onValueChange={filterUsers}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrează după rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toți utilizatorii ({users.length})</SelectItem>
                <SelectItem value="client">Clienți ({userStats.clients})</SelectItem>
                <SelectItem value="facility_owner">Baze Sportive ({userStats.facilityOwners})</SelectItem>
                <SelectItem value="admin">Administratori ({userStats.admins})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Afișați: <span className="font-medium text-foreground">{filteredUsers.length}</span> din <span className="font-medium text-foreground">{users.length}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista Utilizatori
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {roleFilter === 'all' ? 'Nu există utilizatori înregistrați' : `Nu există utilizatori cu rolul selectat`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizator</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tip Utilizator</TableHead>
                    <TableHead>Data înregistrării</TableHead>
                    <TableHead>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                            user.role === 'admin' ? 'bg-red-500' : 
                            user.role === 'facility_owner' ? 'bg-blue-500' : 'bg-green-500'
                          }`}>
                            {user.role === 'admin' ? <Shield className="h-5 w-5" /> :
                             user.role === 'facility_owner' ? <Building2 className="h-5 w-5" /> :
                             <Users className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{getRoleDescription(user.role)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.role !== 'admin' && user.role !== 'facility_owner' && (
                            <Button variant="outline" size="sm" onClick={() => promoteToFacilityOwner(user.user_id, user.email)}>
                              <Building2 className="h-4 w-4 mr-1" />
                              Promovează Bază Sportivă
                            </Button>
                          )}
                          {user.role !== 'admin' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Shield className="h-4 w-4 mr-1" />
                                  Promovează Admin
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Promovare la Administrator</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Ești sigur că vrei să promovezi utilizatorul <strong>{user.full_name}</strong> la administrator? 
                                    Acesta va avea acces complet la panoul de administrare.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Anulează</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => promoteToAdmin(user.user_id, user.email)}>
                                    Promovează
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Șterge
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Ștergere Cont Utilizator</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ești sigur că vrei să ștergi contul utilizatorului <strong>{user.full_name}</strong>? 
                                  Această acțiune este permanentă și nu poate fi anulată. Toate datele asociate acestui utilizator vor fi șterse.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Anulează</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteUser(user.user_id, user.email)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Șterge Definitiv
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;