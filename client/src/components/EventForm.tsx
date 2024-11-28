import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent } from "@db/schema";
import { prefectures } from "@/lib/prefectures";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface EventFormProps {
  onSubmit: (data: InsertEvent) => Promise<void>;
}

export function EventForm({ onSubmit }: EventFormProps) {
  // 現在時刻を15分単位に切り上げ
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  const defaultDate = new Date(now);
  defaultDate.setMinutes(roundedMinutes);
  if (roundedMinutes === 60) {
    defaultDate.setHours(defaultDate.getHours() + 1);
    defaultDate.setMinutes(0);
  }

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      prefecture: "",
      date: defaultDate,
      website: "",
      description: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <DialogDescription>
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
            <FormItem className="flex flex-col">
              <FormLabel>開催日時</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "yyyy年MM月dd日(E) HH:mm", { locale: ja })
                      ) : (
                        <span>日付と時間を選択</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                          const currentValue = field.value || defaultDate;
                          newDate.setHours(currentValue.getHours());
                          newDate.setMinutes(currentValue.getMinutes());
                          field.onChange(newDate);
                        }
                      }}
                      locale={ja}
                      initialFocus
                      disabled={(date) => {
                        // 過去の日付を選択できないようにする
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const targetDate = new Date(date);
                        targetDate.setHours(0, 0, 0, 0);
                        return targetDate < today;
                      }}
                    />
                  </div>
                  <div className="p-3 border-t">
                    <Select
                      value={field.value ? format(field.value, "HH:mm") : format(defaultDate, "HH:mm")}
                      onValueChange={(time) => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const newDate = new Date(field.value || defaultDate);
                        newDate.setHours(hours);
                        newDate.setMinutes(minutes);
                        field.onChange(newDate);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="時間を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 * 4 }, (_, i) => {
                          const hours = Math.floor(i / 4);
                          const minutes = (i % 4) * 15;
                          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        }).map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webサイト URL（任意）</FormLabel>
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
              <FormLabel>イベント説明（任意）</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">保存</Button>
      </form>
    </Form>
  );
}
