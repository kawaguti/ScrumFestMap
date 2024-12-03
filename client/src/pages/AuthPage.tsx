import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { login, register, user, changePassword } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // URLのクエリパラメータを取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('change_password') === 'true' && user) {
      setShowPasswordChange(true);
    }
  }, [user]);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      const result = isLogin
        ? await login(data)
        : await register(data);

      if (!result.ok) {
        toast({
          title: "エラー",
          description: result.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isLogin ? "ログイン成功" : "登録成功",
        description: isLogin
          ? "ようこそ！"
          : "アカウントが作成されました。",
      });

      // ホームページへリダイレクト
      setLocation("/");
    } catch (error) {
      toast({
        title: "エラー",
        description: "予期せぬエラーが発生しました。",
        variant: "destructive",
      });
    }
  };

  const PasswordChangeForm = () => {
    const form = useForm({
      defaultValues: {
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }
    });

    const handleSubmit = async (data: any) => {
      if (data.newPassword !== data.confirmPassword) {
        form.setError("confirmPassword", {
          type: "manual",
          message: "新しいパスワードと確認用パスワードが一致しません"
        });
        return;
      }

      try {
        const result = await changePassword({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        });
        
        if (!result.ok) {
          form.setError("root", {
            type: "manual",
            message: result.message
          });
          return;
        }
        
        toast({
          title: "成功",
          description: "パスワードが変更されました",
        });
        setShowPasswordChange(false);
      } catch (error) {
        form.setError("root", {
          type: "manual",
          message: "パスワードの変更に失敗しました"
        });
      }
    };

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>パスワード変更</CardTitle>
          <CardDescription>
            新しいパスワードを設定してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>現在のパスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード（確認）</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <div className="space-y-2">
                <Button type="submit" className="w-full">
                  パスワードを変更
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setLocation('/');
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  if (user && showPasswordChange) {
    return (
      <div className="container mx-auto max-w-md min-h-screen flex items-center justify-center">
        <PasswordChangeForm />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md min-h-screen flex items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{isLogin ? "ログイン" : "新規登録"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "アカウントをお持ちでない場合は新規登録してください。"
              : "すでにアカウントをお持ちの場合はログインしてください。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ユーザー名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isLogin && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>メールアドレス</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Button type="submit" className="w-full">
                  {isLogin ? "ログイン" : "登録"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin
                    ? "新規登録はこちら"
                    : "ログインはこちら"}
                </Button>
                {user && (
                  <Button
                    type="button"
                    variant="link"
                    className="w-full"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    パスワードを変更する
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
