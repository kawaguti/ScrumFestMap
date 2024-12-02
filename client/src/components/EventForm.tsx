import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent } from "@db/schema";
import { prefectures } from "@/lib/prefectures";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";

interface EventFormProps {
  onSubmit: (data: InsertEvent) => Promise<void>;
  defaultValues?: InsertEvent;
}

export function EventForm({ onSubmit, defaultValues }: EventFormProps) {
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: defaultValues || {
      name: "",
      prefecture: "",
      date: new Date(),
      website: "",
      description: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-1">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>イベント名</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prefecture"
          render={({ field }) => (
            <FormItem>
              <DialogDescription className="text-sm text-muted-foreground mb-4">
                イベントの詳細情報を入力してください
              </DialogDescription>
              <FormLabel>開催都道府県</FormLabel>
              <Select 
                onValueChange={field.onChange}
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="都道府県を選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {prefectures.map((pref) => (
                    <SelectItem key={pref.id} value={pref.name}>
                      {pref.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>開催日</FormLabel>
              <FormControl>
                <Input 
                  type="datetime-local" 
                  {...field}
                  value={field.value instanceof Date 
                    ? field.value.toISOString().slice(0, 16)
                    : new Date().toISOString().slice(0, 16)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webサイト URL</FormLabel>
              <FormControl>
                <Input type="url" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>イベント説明</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" className="w-full sm:w-auto">
            保存する
          </Button>
        </div>
      </form>
    </Form>
  );
}