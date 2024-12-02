import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent, type Event } from "@db/schema";
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
  defaultValues?: Event;
  onSubmit: (data: InsertEvent) => Promise<void>;
}

export function EventForm({ defaultValues, onSubmit }: EventFormProps) {
  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: defaultValues ?? {
      name: "",
      prefecture: "",
      date: new Date(),
      website: "",
      description: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-semibold">イベント名</FormLabel>
                <FormControl>
                  <Input 
                    className="h-10 transition-shadow focus:shadow-md" 
                    placeholder="イベント名を入力"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-sm" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prefecture"
            render={({ field }) => (
              <FormItem>
                <DialogDescription>
                  イベントの詳細情報を入力してください
                </DialogDescription>
                <FormLabel className="text-base font-semibold">開催都道府県</FormLabel>
                <Select 
                  onValueChange={field.onChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 transition-shadow focus:shadow-md">
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
                <FormLabel className="text-base font-semibold">開催日</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local" 
                    className="h-10 transition-shadow focus:shadow-md"
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
                <FormLabel className="text-base font-semibold">Webサイト URL</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    className="h-10 transition-shadow focus:shadow-md"
                    placeholder="https://example.com"
                    {...field} 
                    value={field.value || ""} 
                  />
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
                <FormLabel className="text-base font-semibold">イベント説明</FormLabel>
                <FormControl>
                  <Textarea 
                    className="min-h-[100px] transition-shadow focus:shadow-md resize-y"
                    placeholder="イベントの説明を入力"
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="submit" className="w-24">保存</Button>
        </div>
      </form>
    </Form>
  );
}
