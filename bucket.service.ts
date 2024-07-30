import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Subject } from 'rxjs';

import { Bucket } from '../models/models';
import { createBucket, buckets, bucketData, deleteBucket } from '../gql/bucket-consts';
import { playlistToBucket, deletePlaylistFromBucket, playlistsToBucket } from '../gql/playlist-consts';
import { VenueService } from './venue.service';
import { PrepareDataService } from './prepare-data.service';

@Injectable({
  providedIn: 'root'
})
export class BucketService {
  private buckets: Bucket[];

  public onBucketsChanged: BehaviorSubject<Bucket[]> = new BehaviorSubject([]);
  public onBucketChanged: Subject<Bucket> = new Subject();

  constructor(
    private apollo: Apollo,
    private prepareService: PrepareDataService,
    private venueService: VenueService
  ) { }

  getBuckets() {
    return new Promise<Bucket[]>((resolve, reject) => {
      this.apollo.query({
        query: buckets
      })
      .subscribe(
        (data: any) => {
          if (data.data.buckets) {
            const venueId = this.venueService.getSelectedVenueId();
            const sortedBuckets = this.sortBuckets(data.data.buckets);

            this.buckets = sortedBuckets
              .filter(bucket => bucket && bucket.venue.id === venueId)
              .map(bucket => {
                bucket.artwork = this.prepareService.bucketArtwork(bucket);
                return bucket;
              });

            this.onBucketsChanged.next(this.buckets);
          }

          resolve(this.buckets);
        },
        (error) => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  createBucket(name: string) {
    return new Promise<Bucket>((resolve, reject) => {
      this.apollo.mutate({
        mutation: createBucket,
        variables: { name, venueId: this.venueService.getSelectedVenueId() }
      })
      .subscribe(
        (data: any) => {
          if (data.data.createBucket) {
            this.buckets = this.sortBuckets([...this.buckets, data.data.createBucket]);

            this.onBucketsChanged.next(this.buckets);
          }

          resolve(data.data.createBucket);
        },
        (error) => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  hasAnyBucket() {
    return this.buckets && this.buckets.length > 0;
  }

  addPlaylistToBucket(playlistId: number, bucketId: number) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.mutate({
        mutation: playlistToBucket,
        variables: { playlistId, bucketId }
      })
        .subscribe(
          () => {
            this.bucketChangedHandler(bucketId);

            resolve(true);
          },
        (error) => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  addPlaylistsToBucket(playlistIds, bucketId) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.mutate({
        mutation: playlistsToBucket,
        variables: { playlistIds, bucketId }
      })
      .subscribe(
        () => {
          this.bucketChangedHandler(bucketId);

          resolve(true);
        },
        (error) => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  getBucketData(bucketId) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.query({
        query: bucketData,
        variables: {id: bucketId, venueId: this.venueService.getSelectedVenueId() }
      })
        .subscribe(
          (data: any) => {
            resolve(data.data.bucket);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  deleteBucket(id: number) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.mutate({
        mutation: deleteBucket,
        variables: { id }
      })
      .subscribe(
        (data: any) => {
          if (data.data.deleteBucket) {
            const deletedBucketIndex = this.buckets.findIndex((bucketItem) => bucketItem.id === id);

            this.buckets = [...this.buckets.slice(0, deletedBucketIndex), ...this.buckets.slice(deletedBucketIndex + 1)];

            this.onBucketsChanged.next(this.buckets);
          }

          resolve(data.data.deleteBucket);
        },
        (error) => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  deletePlaylistFromBucket(playlistId, bucketId) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.mutate({
        mutation: deletePlaylistFromBucket,
        variables: { bucketId, playlistId }
      })
      .subscribe(
        (data: any) => {
          if (data.data.removePlaylistFromBucket) {
            this.bucketChangedHandler(bucketId);

            resolve(true);
          } else {
            reject(false);
          }
        },
        error => {
          console.log(error);
          reject(error);
        }
      );
    });
  }

  private bucketChangedHandler(bucketId: number) {
    this.getBucketData(bucketId).then((bucket) => {
      const changedBucketIndex = this.buckets.findIndex(x => x.id === bucketId);

      bucket.artwork = this.prepareService.bucketArtwork(bucket);

      this.buckets[changedBucketIndex] = bucket;

      this.onBucketsChanged.next(this.buckets);
      this.onBucketChanged.next(bucket);
    });
  }

  getLibraryBuckets() {
    return this.buckets;
  }

  sortBuckets(unsortedBuckets) {
    return unsortedBuckets.sort((b1, b2) => {
      if (!b1.updatedAt || b1.updatedAt.val) {
        return -1;
      }
      if (!b2.updatedAt || b2.updatedAt.val) {
        return 1;
      }

      return new Date(b2.updatedAt).getTime() - new Date(b1.updatedAt).getTime();
    });
  }
}
