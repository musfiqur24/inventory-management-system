import { PageSkeleton, useMinimumLoading } from "./Skeleton";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
interface PageContainerProps{loading?:boolean;title:string;cap?:string;description?:string;actions?:ReactNode;children:ReactNode;}
export function PageContainer({loading = false,title,cap,description,actions,children}:PageContainerProps){
  const showSkeleton = useMinimumLoading(loading);
  return <section className="mx-auto flex w-full max-w-360 flex-col px-4 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-10 lg:pb-20 lg:pt-9 xl:px-13">
    <PageHeader title={title} cap={cap} description={description} actions={actions}/>
    <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">{showSkeleton ? <PageSkeleton/> : children}</div>
  </section>;
}
