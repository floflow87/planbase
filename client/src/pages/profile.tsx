import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, User, Mail, Briefcase, UserCircle, Phone, Building2, Lock, Eye, EyeOff, Settings as SettingsIcon, Puzzle } from "lucide-react";
import { LoadingState } from "@/design-system/patterns/LoadingState";
import type { appUsers } from "@shared/schema";

const profileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  gender: z.enum(["male", "female", "other"]).optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const accountSchema = z.object({
  name: z.string().min(1, "Le nom du compte est requis"),
  siret: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type AccountFormData = z.infer<typeof accountSchema>;
type AppUser = typeof appUsers.$inferSelect;

interface Account {
  id: string;
  name: string;
  siret?: string | null;
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Fetch user profile
  const { data: userProfile, isLoading } = useQuery<AppUser>({
    queryKey: ["/api/me"],
    enabled: !!user,
  });

  // Fetch account info for integrations tab
  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/accounts", userProfile?.accountId],
    enabled: !!userProfile?.accountId,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
      gender: (userProfile?.gender as "male" | "female" | "other") || undefined,
      position: userProfile?.position || "",
      phone: userProfile?.phone || "",
      company: userProfile?.company || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name || "",
      siret: account?.siret || "",
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (userProfile) {
      form.reset({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        gender: userProfile.gender as "male" | "female" | "other" | undefined,
        position: userProfile.position || "",
        phone: userProfile.phone || "",
        company: userProfile.company || "",
      });
    }
  }, [userProfile, form]);

  // Update account form when data loads
  useEffect(() => {
    if (account) {
      accountForm.reset({
        name: account.name || "",
        siret: account.siret || "",
      });
    }
  }, [account, accountForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("/api/me", "PATCH", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/me"], updatedUser);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le profil",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await apiRequest("/api/me/password", "PATCH", {
        newPassword: data.newPassword
      });
      return response.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été changé avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le mot de passe",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      if (!userProfile?.accountId) {
        throw new Error("Account ID not found");
      }
      const response = await apiRequest(`/api/accounts/${userProfile.accountId}`, "PATCH", data);
      return response.json();
    },
    onSuccess: (updatedAccount) => {
      queryClient.setQueryData(["/api/accounts", userProfile?.accountId], updatedAccount);
      toast({
        title: "Compte mis à jour",
        description: "Les informations du compte ont été enregistrées avec succès",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le compte",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate(data);
  };

  const onAccountSubmit = (data: AccountFormData) => {
    updateAccountMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="p-6">
        <Tabs defaultValue="informations" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-profile">
            <TabsTrigger value="informations" data-testid="tab-informations">
              <UserCircle className="w-4 h-4 mr-2" />
              Informations
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Puzzle className="w-4 h-4 mr-2" />
              Intégrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informations" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[18px]">
                      <UserCircle className="w-5 h-5" />
                      Informations personnelles
                    </CardTitle>
                  </div>
                  {userProfile?.account?.plan && (
                    <Badge 
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold" 
                      data-testid="badge-plan"
                    >
                      {userProfile.account.plan === 'starter' ? 'Start' : userProfile.account.plan}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Ces informations seront visibles par les autres membres de votre équipe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Prénom *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Jean"
                                data-testid="input-first-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Nom *
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Dupont"
                                data-testid="input-last-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email *
                        </Label>
                        <Input
                          type="email"
                          value={userProfile?.email || ""}
                          disabled
                          className="bg-muted"
                          data-testid="input-email"
                        />
                        <p className="text-xs text-muted-foreground">
                          L'email ne peut pas être modifié depuis cette page
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Civilité</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              data-testid="select-gender"
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-background">
                                <SelectItem value="male">Homme</SelectItem>
                                <SelectItem value="female">Femme</SelectItem>
                                <SelectItem value="other">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                            <div className="h-5" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              Poste
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Développeur Full-Stack"
                                data-testid="input-position"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              Téléphone
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+33 6 12 34 56 78"
                                data-testid="input-phone"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              Nom de société
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ma Société"
                                data-testid="input-company"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        data-testid="button-cancel"
                        className="text-[12px]"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                        className="text-[12px]"
                      >
                        {updateProfileMutation.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[18px]">
                  <Building2 className="w-5 h-5" />
                  Informations du compte
                </CardTitle>
                <CardDescription>
                  Informations de votre organisation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <Form {...accountForm}>
                    <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={accountForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Nom du compte *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Mon entreprise"
                                  data-testid="input-account-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={accountForm.control}
                          name="siret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                SIRET
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="123 456 789 00012"
                                  data-testid="input-account-siret"
                                  {...field}
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">
                                Numéro SIRET de votre entreprise (14 chiffres)
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => accountForm.reset()}
                          data-testid="button-cancel-account-info"
                          className="text-[12px]"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateAccountMutation.isPending}
                          data-testid="button-save-account-info"
                          className="text-[12px]"
                        >
                          {updateAccountMutation.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Enregistrer
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[18px]">
                  <Lock className="w-5 h-5" />
                  Modifier le mot de passe
                </CardTitle>
                <CardDescription>
                  Changez votre mot de passe pour sécuriser votre compte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nouveau mot de passe *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showNewPassword ? "text" : "password"}
                                  placeholder="Minimum 8 caractères"
                                  data-testid="input-new-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2"
                                  data-testid="button-toggle-new-password"
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer le mot de passe *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="Retapez le mot de passe"
                                  data-testid="input-confirm-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2"
                                  data-testid="button-toggle-confirm-password"
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => passwordForm.reset()}
                        data-testid="button-cancel-password"
                        className="text-[12px]"
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={updatePasswordMutation.isPending}
                        data-testid="button-save-password"
                        className="text-[12px]"
                      >
                        {updatePasswordMutation.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Mettre à jour le mot de passe
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <div className="max-w-3xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-violet-100 dark:bg-violet-900/30">
                      <SettingsIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="font-semibold tracking-tight text-[18px]">Informations du compte</CardTitle>
                      <CardDescription>
                        Gérez les paramètres de votre compte
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {accountLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Nom du compte
                        </Label>
                        <Input
                          value={account?.name || ""}
                          disabled
                          className="bg-muted"
                          data-testid="input-account-name-readonly"
                        />
                        <p className="text-xs text-muted-foreground">
                          Nom de votre organisation (modifiable depuis l'onglet Informations)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>ID du compte</Label>
                        <Input
                          value={account?.id || ""}
                          disabled
                          className="bg-muted font-mono text-xs"
                          data-testid="input-account-id"
                        />
                        <p className="text-xs text-muted-foreground">
                          L'ID du compte est utilisé pour les intégrations et ne peut pas être modifié
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Intégrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">Google Calendar - Connectez votre calendrier depuis la page Calendrier</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Les credentials Google OAuth sont configurés au niveau de l'application.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
